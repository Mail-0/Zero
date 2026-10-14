import {
  AI_WORKFLOWS,
  isAiEnabled,
  planLiveRun,
  resolveAiSettings,
  summariesEnabled,
} from './ai-settings';
import { aiSettingsSchema, defaultAiSettings, type AiSettings } from './schemas';
import { describe, expect, it } from 'vitest';

const with_ = (patch: Partial<AiSettings>): AiSettings => ({ ...defaultAiSettings, ...patch });

describe('resolveAiSettings', () => {
  it('defaults to AI on, summaries and labels on, drafts off', () => {
    expect(resolveAiSettings(undefined)).toEqual(defaultAiSettings);
    expect(resolveAiSettings({ language: 'en' })).toEqual({
      disabled: false,
      summaries: true,
      autoLabels: true,
      replyDrafts: false,
    });
  });

  it('keeps stored choices and falls back on invalid data', () => {
    expect(resolveAiSettings({ ai: { replyDrafts: true } }).replyDrafts).toBe(true);
    expect(resolveAiSettings({ ai: { disabled: true } }).disabled).toBe(true);
    expect(resolveAiSettings({ ai: { summaries: 'yes' } })).toEqual(defaultAiSettings);
  });

  it('treats settings saved before the master switch existed as enabled', () => {
    const legacy = { ai: { summaries: false, autoLabels: true, replyDrafts: false } };
    expect(isAiEnabled(resolveAiSettings(legacy))).toBe(true);
  });

  it('rejects duplicate custom label names', () => {
    const labels = [
      { name: 'Finance', usecase: '' },
      { name: 'finance', usecase: '' },
    ];
    expect(aiSettingsSchema.safeParse({ labels }).success).toBe(false);
  });
});

describe('summariesEnabled', () => {
  it('needs both AI on and summaries on', () => {
    expect(summariesEnabled(defaultAiSettings)).toBe(true);
    expect(summariesEnabled(with_({ summaries: false }))).toBe(false);
    expect(summariesEnabled(with_({ disabled: true }))).toBe(false);
  });
});

describe('planLiveRun', () => {
  it('runs nothing when every feature is off', () => {
    expect(
      planLiveRun(with_({ summaries: false, autoLabels: false, replyDrafts: false })),
    ).toBeNull();
  });

  it('runs nothing when AI is disabled, even with features on', () => {
    expect(
      planLiveRun(with_({ disabled: true, summaries: true, autoLabels: true, replyDrafts: true })),
    ).toBeNull();
  });

  it('defaults to vectors, summary and labels without drafts', () => {
    expect(planLiveRun(defaultAiSettings)).toEqual({
      workflows: [AI_WORKFLOWS.vectors, AI_WORKFLOWS.summary, AI_WORKFLOWS.labels],
      draft: false,
      summary: true,
    });
  });

  it('still summarizes for labels when summaries are hidden', () => {
    expect(
      planLiveRun(with_({ summaries: false, autoLabels: true, replyDrafts: false }))?.workflows,
    ).toContain(AI_WORKFLOWS.summary);
  });

  it('drafts first when enabled, and never on a retry that already drafted', () => {
    const settings = with_({ summaries: false, autoLabels: false, replyDrafts: true });
    expect(planLiveRun(settings)?.workflows).toEqual([AI_WORKFLOWS.draft, AI_WORKFLOWS.vectors]);
    expect(planLiveRun(settings, { skipDraft: true })).toEqual({
      workflows: [AI_WORKFLOWS.vectors],
      draft: false,
      summary: false,
    });
  });
});
