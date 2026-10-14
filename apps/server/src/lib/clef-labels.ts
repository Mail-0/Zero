export const LABEL_MODEL = '@cf/cloudflare/clef';

/** Minimum yes-probability for a label to be applied. */
export const LABEL_THRESHOLD = 0.5;
/** Matches the previous prompt's "up to 3 labels" rule. */
export const MAX_LABELS = 3;
/** Clef accepts at most 64 questions per request. */
const MAX_QUESTIONS = 64;

export type LabelCandidate = { name: string; usecase: string };

type NoulQuestion = {
  type: 'noul';
  instructions: string;
  criteria: { true: string; false: string };
};

export type ClefLabelRequest = {
  model: 'clef';
  state: { summary: string; currentLabels: string[] };
  questions: Record<string, NoulQuestion>;
};

type ClefAnswer = { type?: string; noul?: unknown };
export type ClefLabelResponse = { answers?: Record<string, ClefAnswer | undefined> } | undefined;

/**
 * Builds one yes/no question per candidate label. Question ids are positional
 * (`label_0`, ...) because label names may contain characters Clef rejects in ids.
 */
export function buildLabelRequest(
  summary: string,
  labels: LabelCandidate[],
  currentLabels: string[],
): ClefLabelRequest | null {
  const candidates = dedupe(labels).slice(0, MAX_QUESTIONS);
  if (!summary.trim() || candidates.length === 0) return null;
  const questions: Record<string, NoulQuestion> = {};
  candidates.forEach((label, index) => {
    const usecase = label.usecase?.trim();
    questions[`label_${index}`] = {
      type: 'noul',
      instructions: `Should this email thread be labeled "${label.name}"?${
        usecase ? ` This label is for: ${usecase}` : ''
      }`,
      criteria: {
        true: `The thread clearly belongs under "${label.name}".`,
        false: `The thread does not fit "${label.name}", or only mentions it in passing.`,
      },
    };
  });
  return { model: 'clef', state: { summary, currentLabels }, questions };
}

/** Picks the labels Clef is confident about, highest probability first. */
export function pickLabels(
  labels: LabelCandidate[],
  response: ClefLabelResponse,
  threshold = LABEL_THRESHOLD,
  max = MAX_LABELS,
): string[] {
  const candidates = dedupe(labels).slice(0, MAX_QUESTIONS);
  const answers = response?.answers ?? {};
  return candidates
    .map((label, index) => ({ name: label.name, p: answers[`label_${index}`]?.noul }))
    .filter((entry): entry is { name: string; p: number } => typeof entry.p === 'number')
    .filter((entry) => entry.p >= threshold)
    .sort((a, b) => b.p - a.p)
    .slice(0, max)
    .map((entry) => entry.name);
}

function dedupe(labels: LabelCandidate[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = label.name?.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
