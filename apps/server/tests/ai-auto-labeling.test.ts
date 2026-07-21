import {
  applyAutoLabelClassification,
  classifyThread,
  type AutoLabelAgent,
} from '../src/lib/ai-auto-labeling';
import type { IGetThreadResponse } from '../src/lib/driver/types';
import { describe, expect, it } from 'vitest';

function makeThread(overrides: {
  subject?: string;
  body?: string;
  sender?: string;
  listUnsubscribe?: string;
  labels?: { id: string; name: string }[];
}): IGetThreadResponse {
  const labels = overrides.labels ?? [];
  return {
    messages: [
      {
        id: 'message-1',
        title: overrides.subject ?? '',
        subject: overrides.subject ?? '',
        tags: labels.map((label) => ({ ...label, type: 'user' })),
        sender: { email: overrides.sender ?? 'sender@example.com' },
        to: [{ email: 'mason@example.com' }],
        cc: null,
        bcc: null,
        tls: true,
        listUnsubscribe: overrides.listUnsubscribe,
        receivedOn: new Date().toISOString(),
        unread: true,
        body: overrides.body ?? '',
        processedHtml: '',
        blobUrl: '',
        threadId: 'thread-1',
      },
    ],
    latest: undefined,
    hasUnread: true,
    totalReplies: 1,
    labels,
  };
}

describe('classifyThread', () => {
  it('prioritizes OCTG-specific language', () => {
    const result = classifyThread(
      makeThread({
        subject: 'RFQ for API 5CT P110 casing',
        body: 'Please quote the OCTG inventory at your pipe yard.',
      }),
    );

    expect(result.category).toBe('octg');
    expect(result.labelName).toBe('OCTG');
  });

  it('detects newsletters from mailing-list headers', () => {
    const result = classifyThread(
      makeThread({
        subject: 'Weekly product digest',
        listUnsubscribe: 'https://example.com/unsubscribe',
      }),
    );

    expect(result.category).toBe('newsletters');
    expect(result.labelName).toBe('Tools/Newsletters');
  });

  it('detects finance messages', () => {
    const result = classifyThread(
      makeThread({
        subject: 'Your monthly credit card statement',
        body: 'A payment was posted to your account.',
      }),
    );

    expect(result.category).toBe('finance');
  });

  it('detects personal correspondence', () => {
    const result = classifyThread(
      makeThread({
        subject: 'Dinner this weekend',
        body: 'Hi Mason, should we catch up with the family on Saturday?',
      }),
    );

    expect(result.category).toBe('personal');
  });

  it('trusts the provider spam label', () => {
    const result = classifyThread(
      makeThread({
        subject: 'Normal-looking subject',
        labels: [{ id: 'SPAM', name: 'SPAM' }],
      }),
    );

    expect(result.category).toBe('spam');
    expect(result.confidence).toBe(0.99);
  });

  it('returns none for weak or ambiguous messages', () => {
    const result = classifyThread(makeThread({ subject: 'Quick note', body: 'Thanks.' }));

    expect(result.category).toBe('none');
    expect(result.labelName).toBeNull();
  });
});

describe('applyAutoLabelClassification', () => {
  it('creates a missing managed label and applies it through the provider-backed action', async () => {
    let labels = [
      {
        id: 'finance-id',
        name: 'Finance',
        type: 'user',
      },
    ];
    const applied: { threadId: string; add: string[]; remove: string[] }[] = [];
    const agent: AutoLabelAgent = {
      getUserLabels: async () => labels,
      createLabel: async ({ name }) => {
        labels = [...labels, { id: 'octg-id', name, type: 'user' }];
      },
      applyAutoLabel: async (threadId, add, remove) => {
        applied.push({ threadId, add, remove });
      },
    };
    const classification = classifyThread(
      makeThread({
        subject: 'OCTG inventory',
        body: 'Please quote P110 casing.',
      }),
    );

    const result = await applyAutoLabelClassification(agent, 'thread-1', classification, [
      'finance-id',
    ]);

    expect(result.applied).toBe(true);
    expect(applied).toEqual([
      {
        threadId: 'thread-1',
        add: ['octg-id'],
        remove: ['finance-id'],
      },
    ]);
  });
});
