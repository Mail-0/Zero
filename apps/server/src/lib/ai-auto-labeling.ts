import type { IGetThreadResponse } from './driver/types';
import type { Label } from '../types';

export const autoLabelDefinitions = {
  octg: {
    labelName: 'OCTG',
    description:
      'Pipe inventory, brokers, mills, tubular services, RFQs, OCTG sales, and purchasing.',
  },
  newsletters: {
    labelName: 'Tools/Newsletters',
    description:
      'Product updates, newsletters, software tools, AI services, and recurring marketing.',
  },
  personal: {
    labelName: 'Personal',
    description: 'Direct personal correspondence, family, travel, appointments, and relationships.',
  },
  finance: {
    labelName: 'Finance',
    description:
      'Banks, cards, invoices, subscriptions, receipts, taxes, investing, and personal finance.',
  },
  spam: {
    labelName: 'SPAM',
    description: 'Provider-confirmed spam or messages with strong unsolicited-risk signals.',
  },
} as const;

export type AutoLabelCategory = keyof typeof autoLabelDefinitions;
export type AutoLabelClassification = {
  category: AutoLabelCategory | 'none';
  labelName: string | null;
  confidence: number;
  reason: string;
  scores: Record<AutoLabelCategory, number>;
};

type WeightedPattern = {
  label: string;
  pattern: RegExp;
  weight: number;
};

const patterns: Record<AutoLabelCategory, WeightedPattern[]> = {
  octg: [
    { label: 'OCTG', pattern: /\boctg\b/i, weight: 5 },
    { label: 'tubular', pattern: /\btubular(?:s|\s+services?)?\b/i, weight: 4 },
    { label: 'casing or tubing', pattern: /\b(?:casing|production tubing)\b/i, weight: 3 },
    { label: 'drill or line pipe', pattern: /\b(?:drill|line)\s+pipe\b/i, weight: 3 },
    { label: 'pipe inventory', pattern: /\bpipe\s+(?:inventory|yard|broker|mill)\b/i, weight: 3 },
    { label: 'pipe grade', pattern: /\b(?:p110|l80|n80|j55|api\s+5ct)\b/i, weight: 3 },
    {
      label: 'pipe components',
      pattern: /\b(?:pup joint|coupling|thread protector)\b/i,
      weight: 3,
    },
    { label: 'RFQ', pattern: /\b(?:rfq|request for quote)\b/i, weight: 2 },
  ],
  newsletters: [
    { label: 'newsletter', pattern: /\bnewsletter\b/i, weight: 3 },
    { label: 'digest', pattern: /\b(?:daily|weekly|monthly)?\s*digest\b/i, weight: 2 },
    { label: 'product update', pattern: /\bproduct\s+(?:update|news|release)\b/i, weight: 2 },
    { label: 'webinar', pattern: /\bwebinar\b/i, weight: 2 },
    {
      label: 'marketing offer',
      pattern: /\b(?:sale|promo code|special offer|limited time)\b/i,
      weight: 2,
    },
    { label: 'unsubscribe', pattern: /\bunsubscribe\b/i, weight: 2 },
  ],
  personal: [
    { label: 'personal greeting', pattern: /\b(?:hi|hey|hello)\s+mason\b/i, weight: 2 },
    { label: 'family', pattern: /\b(?:family|mom|dad|brother|sister)\b/i, weight: 3 },
    {
      label: 'personal plans',
      pattern: /\b(?:dinner|birthday|wedding|weekend|catch up)\b/i,
      weight: 2,
    },
    { label: 'travel plans', pattern: /\b(?:flight|hotel|trip|vacation|itinerary)\b/i, weight: 2 },
    { label: 'appointment', pattern: /\bappointment\b/i, weight: 2 },
  ],
  finance: [
    { label: 'invoice', pattern: /\b(?:invoice|receipt|statement)\b/i, weight: 3 },
    { label: 'payment', pattern: /\b(?:payment|transaction|deposit|withdrawal)\b/i, weight: 2 },
    {
      label: 'banking',
      pattern: /\b(?:bank|credit card|debit card|checking|savings)\b/i,
      weight: 3,
    },
    { label: 'subscription billing', pattern: /\b(?:subscription|renewal|billing)\b/i, weight: 2 },
    { label: 'tax or payroll', pattern: /\b(?:tax|irs|payroll|w-?2|1099)\b/i, weight: 3 },
    {
      label: 'investing',
      pattern: /\b(?:brokerage|portfolio|dividend|robinhood|origin financial)\b/i,
      weight: 3,
    },
  ],
  spam: [
    {
      label: 'credential lure',
      pattern: /\b(?:verify your account|password expires?|unusual login)\b/i,
      weight: 3,
    },
    {
      label: 'prize lure',
      pattern: /\b(?:you(?:'|\u2019)ve won|claim your prize|lottery winner)\b/i,
      weight: 4,
    },
    {
      label: 'high-pressure offer',
      pattern: /\b(?:act now|urgent action required|risk[- ]free)\b/i,
      weight: 2,
    },
    {
      label: 'crypto solicitation',
      pattern: /\b(?:guaranteed returns?|crypto giveaway)\b/i,
      weight: 3,
    },
  ],
};

const categoryPriority: AutoLabelCategory[] = [
  'spam',
  'octg',
  'finance',
  'newsletters',
  'personal',
];

const roundConfidence = (value: number) => Math.round(value * 100) / 100;

export function hasProviderSpamLabel(thread: IGetThreadResponse) {
  return [
    ...thread.labels.flatMap((label) => [label.id, label.name]),
    ...thread.messages.flatMap((message) => message.tags.flatMap((tag) => [tag.id, tag.name])),
  ].some((label) => label.toUpperCase() === 'SPAM');
}

export function classifyThread(thread: IGetThreadResponse): AutoLabelClassification {
  const scores: Record<AutoLabelCategory, number> = {
    octg: 0,
    newsletters: 0,
    personal: 0,
    finance: 0,
    spam: 0,
  };
  const matches = new Map<AutoLabelCategory, string[]>();
  const messages = thread.messages.filter((message) => !message.isDraft);

  if (hasProviderSpamLabel(thread)) {
    return {
      category: 'spam',
      labelName: autoLabelDefinitions.spam.labelName,
      confidence: 0.99,
      reason: 'Gmail already marked this thread as spam.',
      scores: { ...scores, spam: 10 },
    };
  }

  const searchableText = messages
    .map((message) =>
      [
        message.subject,
        message.title,
        message.sender.name,
        message.sender.email,
        message.decodedBody,
        message.body,
      ]
        .filter(Boolean)
        .join(' '),
    )
    .join(' ');

  for (const category of categoryPriority) {
    const categoryMatches: string[] = [];
    for (const candidate of patterns[category]) {
      if (candidate.pattern.test(searchableText)) {
        scores[category] += candidate.weight;
        categoryMatches.push(candidate.label);
      }
    }
    matches.set(category, categoryMatches);
  }

  if (messages.some((message) => message.listUnsubscribe || message.listUnsubscribePost)) {
    scores.newsletters += 4;
    matches.set('newsletters', ['mailing-list headers', ...(matches.get('newsletters') ?? [])]);
  }

  const hasAutomatedSender = messages.some((message) =>
    /\b(?:no-?reply|notifications?|mailer|marketing)\b/i.test(message.sender.email),
  );
  if (hasAutomatedSender) scores.newsletters += 1;

  const ranked = categoryPriority
    .map((category) => ({ category, score: scores[category] }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        categoryPriority.indexOf(a.category) - categoryPriority.indexOf(b.category),
    );
  const winner = ranked[0];
  const runnerUp = ranked[1];

  if (!winner || winner.score < 2) {
    return {
      category: 'none',
      labelName: null,
      confidence: 0,
      reason: 'No category passed the minimum heuristic score.',
      scores,
    };
  }

  const margin = winner.score - (runnerUp?.score ?? 0);
  const confidence = roundConfidence(Math.min(0.98, 0.5 + winner.score * 0.06 + margin * 0.04));
  const matchedSignals = (matches.get(winner.category) ?? []).slice(0, 3);

  return {
    category: winner.category,
    labelName: autoLabelDefinitions[winner.category].labelName,
    confidence,
    reason: matchedSignals.length
      ? `Matched ${matchedSignals.join(', ')}.`
      : `Matched ${autoLabelDefinitions[winner.category].description}`,
    scores,
  };
}

export interface AutoLabelAgent {
  getUserLabels(): Promise<Label[]>;
  createLabel(params: { name: string }): Promise<unknown>;
  applyAutoLabel(
    threadId: string,
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<unknown>;
}

export async function applyAutoLabelClassification(
  agent: AutoLabelAgent,
  threadId: string,
  classification: AutoLabelClassification,
  currentLabelIds: string[],
) {
  if (classification.category === 'none' || !classification.labelName) {
    return { applied: false, reason: 'No label was suggested.' };
  }

  let accountLabels = await agent.getUserLabels();
  let targetLabel = accountLabels.find(
    (label) => label.name.toLowerCase() === classification.labelName?.toLowerCase(),
  );

  if (!targetLabel && classification.category !== 'spam') {
    await agent.createLabel({ name: classification.labelName });
    accountLabels = await agent.getUserLabels();
    targetLabel = accountLabels.find(
      (label) => label.name.toLowerCase() === classification.labelName?.toLowerCase(),
    );
  }

  if (!targetLabel) {
    throw new Error(`Unable to find or create label "${classification.labelName}"`);
  }

  const managedNames = new Set(
    Object.values(autoLabelDefinitions)
      .filter((definition) => definition.labelName !== 'SPAM')
      .map((definition) => definition.labelName.toLowerCase()),
  );
  const managedIds = new Set(
    accountLabels
      .filter((label) => managedNames.has(label.name.toLowerCase()))
      .map((label) => label.id),
  );
  const addLabelIds = currentLabelIds.includes(targetLabel.id) ? [] : [targetLabel.id];
  const removeLabelIds =
    classification.category === 'spam'
      ? []
      : currentLabelIds.filter((id) => managedIds.has(id) && id !== targetLabel.id);

  if (!addLabelIds.length && !removeLabelIds.length) {
    return { applied: false, reason: 'The suggested label is already applied.' };
  }

  await agent.applyAutoLabel(threadId, addLabelIds, removeLabelIds);

  return {
    applied: true,
    labelId: targetLabel.id,
    labelName: targetLabel.name,
    addLabelIds,
    removeLabelIds,
  };
}
