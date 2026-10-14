import { aiSettingsSchema, defaultAiSettings, type AiSettings } from './schemas';

export const AI_WORKFLOWS = {
  draft: 'auto-draft-generation',
  vectors: 'message-vectorization',
  summary: 'thread-summary',
  labels: 'label-generation',
} as const;

/** Reads the `ai` block from stored user settings, falling back to defaults. */
export function resolveAiSettings(stored: unknown): AiSettings {
  const raw = (stored as { ai?: unknown } | null | undefined)?.ai;
  const parsed = aiSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : defaultAiSettings;
}

/** False when the user has turned AI off entirely. */
export function isAiEnabled(settings: AiSettings): boolean {
  return !settings.disabled;
}

/** Whether thread summaries (background and on-open) may run. */
export function summariesEnabled(settings: AiSettings): boolean {
  return isAiEnabled(settings) && settings.summaries;
}

/**
 * Which workflows a live run executes, in dependency order (labels read the
 * summary). Returns null when AI is disabled or every background feature is off.
 */
export function planLiveRun(settings: AiSettings, options: { skipDraft?: boolean } = {}) {
  if (!isAiEnabled(settings)) return null;
  if (!settings.summaries && !settings.autoLabels && !settings.replyDrafts) return null;
  const draft = settings.replyDrafts && !options.skipDraft;
  const summary = settings.summaries || settings.autoLabels;
  const workflows: string[] = [];
  if (draft) workflows.push(AI_WORKFLOWS.draft);
  workflows.push(AI_WORKFLOWS.vectors);
  if (summary) workflows.push(AI_WORKFLOWS.summary);
  if (settings.autoLabels) workflows.push(AI_WORKFLOWS.labels);
  return { workflows, draft, summary };
}
