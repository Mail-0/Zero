/**
 * Gmail search results reflect provider state, which trails locally queued label
 * mutations (see MailLabelStore intents) by at least the outbox dispatch delay.
 * This module evaluates the label-only parts of a Gmail query against local,
 * intent-overlaid labels so threads that can no longer match are dropped
 * immediately (e.g. a thread marked read disappearing from an `is:unread` view).
 *
 * Evaluation is three-valued: terms that cannot be decided from labels alone
 * (from:, subject:, free text, ...) are unknown. A thread is only excluded when
 * the query is definitely false for every one of its messages, so unknown terms
 * always defer to the provider's verdict.
 */

type Tri = boolean | null;

type Node =
  | { kind: 'term'; value: string }
  | { kind: 'not'; node: Node }
  | { kind: 'and' | 'or'; nodes: Node[] };

type Token = '(' | ')' | '{' | '}' | 'OR' | 'AND' | 'NOT' | '-' | { term: string };

const LABEL_TERMS: Record<string, { label: string; present: boolean }> = {
  'is:unread': { label: 'UNREAD', present: true },
  'is:read': { label: 'UNREAD', present: false },
  'is:starred': { label: 'STARRED', present: true },
  'is:important': { label: 'IMPORTANT', present: true },
  'is:sent': { label: 'SENT', present: true },
  'in:sent': { label: 'SENT', present: true },
  'is:draft': { label: 'DRAFT', present: true },
  'in:draft': { label: 'DRAFT', present: true },
  'in:drafts': { label: 'DRAFT', present: true },
  'in:inbox': { label: 'INBOX', present: true },
  'in:spam': { label: 'SPAM', present: true },
  'in:trash': { label: 'TRASH', present: true },
};

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < query.length) {
    const char = query[i]!;
    if (/\s/.test(char)) {
      i++;
      continue;
    }
    if (char === '(' || char === ')' || char === '{' || char === '}') {
      tokens.push(char);
      i++;
      continue;
    }
    if (char === '-' && i + 1 < query.length && !/\s/.test(query[i + 1]!)) {
      tokens.push('-');
      i++;
      continue;
    }
    let word = '';
    while (i < query.length) {
      const c = query[i]!;
      if (/\s/.test(c) || c === ')' || c === '{' || c === '}') break;
      if (c === '"') {
        const end = query.indexOf('"', i + 1);
        if (end === -1) throw new Error('Unterminated quote');
        word += query.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      if (c === '(') {
        // `subject:(a b)` groups belong to the operator; a bare `(` starts a group.
        if (!word.endsWith(':')) break;
        let depth = 0;
        const start = i;
        for (; i < query.length; i++) {
          if (query[i] === '(') depth++;
          else if (query[i] === ')' && --depth === 0) break;
        }
        if (depth !== 0) throw new Error('Unbalanced parentheses');
        word += query.slice(start, ++i);
        continue;
      }
      word += c;
      i++;
    }
    if (!word) throw new Error(`Unexpected character ${char}`);
    if (word === 'OR' || word === 'AND' || word === 'NOT') tokens.push(word);
    else tokens.push({ term: word });
  }
  return tokens;
}

function parse(query: string): Node {
  const tokens = tokenize(query);
  let pos = 0;
  const peek = () => tokens[pos];

  // Gmail binds OR tighter than (implicit) AND: `a b OR c` == `a (b OR c)`.
  function parseAnd(): Node {
    const nodes: Node[] = [];
    while (pos < tokens.length && peek() !== ')' && peek() !== '}') {
      if (peek() === 'AND') {
        pos++;
        continue;
      }
      nodes.push(parseOr());
    }
    return nodes.length === 1 ? nodes[0]! : { kind: 'and', nodes };
  }

  function parseOr(): Node {
    const nodes = [parseUnary()];
    while (peek() === 'OR') {
      pos++;
      nodes.push(parseUnary());
    }
    return nodes.length === 1 ? nodes[0]! : { kind: 'or', nodes };
  }

  function parseUnary(): Node {
    const token = tokens[pos++];
    if (token === undefined) throw new Error('Unexpected end of query');
    if (token === '-' || token === 'NOT') return { kind: 'not', node: parseUnary() };
    if (token === '(') {
      const node = parseAnd();
      if (tokens[pos++] !== ')') throw new Error('Expected )');
      return node;
    }
    if (token === '{') {
      const nodes: Node[] = [];
      while (pos < tokens.length && peek() !== '}') {
        if (peek() === 'OR') {
          pos++;
          continue;
        }
        nodes.push(parseUnary());
      }
      if (tokens[pos++] !== '}') throw new Error('Expected }');
      return { kind: 'or', nodes };
    }
    if (typeof token === 'object') return { kind: 'term', value: token.term };
    throw new Error(`Unexpected token ${token}`);
  }

  const node = parseAnd();
  if (pos !== tokens.length) throw new Error('Unexpected trailing tokens');
  return node;
}

type TermMap = Record<string, { label: string; present: boolean } | false>;

function evaluate(node: Node, labels: Set<string>, terms: TermMap = LABEL_TERMS): Tri {
  switch (node.kind) {
    case 'term': {
      const term = terms[node.value.toLowerCase()];
      if (term === false) return false;
      return term ? labels.has(term.label) === term.present : null;
    }
    case 'not': {
      const value = evaluate(node.node, labels, terms);
      return value === null ? null : !value;
    }
    case 'and': {
      let result: Tri = true;
      for (const child of node.nodes) {
        const value = evaluate(child, labels, terms);
        if (value === false) return false;
        if (value === null) result = null;
      }
      return result;
    }
    case 'or': {
      let result: Tri = false;
      for (const child of node.nodes) {
        const value = evaluate(child, labels, terms);
        if (value === true) return true;
        if (value === null) result = null;
      }
      return result;
    }
  }
}

/**
 * Returns a predicate that reports whether a thread (given the effective labels
 * of each of its messages) may still match `query`. Returns undefined when the
 * query cannot be parsed, in which case callers should trust the provider.
 */
export function compileLabelMatcher(
  query: string,
): ((messages: string[][]) => boolean) | undefined {
  let node: Node;
  try {
    node = parse(query);
  } catch {
    return undefined;
  }
  return (messages) =>
    !messages.length || messages.some((labels) => evaluate(node, new Set(labels)) !== false);
}

const termValues = (node: Node): string[] =>
  node.kind === 'term'
    ? [node.value.toLowerCase()]
    : node.kind === 'not'
      ? termValues(node.node)
      : node.nodes.flatMap(termValues);

/**
 * For providers that keep a full local label index (IMAP): compiles a query whose every term
 * is in `terms` into an exact per-message predicate. A term mapped to `false` is treated as
 * never matching. Returns undefined when any term needs the provider (from:, free text, ...).
 */
export function compileLocalLabelQuery(
  query: string,
  terms: TermMap,
): ((labels: Set<string>) => boolean) | undefined {
  let node: Node;
  try {
    node = parse(query);
  } catch {
    return undefined;
  }
  if (!termValues(node).every((value) => value in terms)) return undefined;
  return (labels) => evaluate(node, labels, terms) === true;
}
