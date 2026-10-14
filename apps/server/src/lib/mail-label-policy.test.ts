import {
  isDurableLabelMutation,
  normalizeDurableLabelMutation,
  splitLabelMutation,
} from './mail-label-policy';
import { describe, expect, it } from 'vitest';

describe('durable label routing', () => {
  it('splits snooze and unsnooze while retaining provider custom IDs and unknown names', () => {
    expect(splitLabelMutation(['SNOOZED', 'Label_123'], ['INBOX'])).toEqual({
      providerAdd: ['Label_123'],
      providerRemove: ['INBOX'],
      syntheticAdd: ['SNOOZED'],
      syntheticRemove: [],
    });
    const unsnooze = splitLabelMutation(['INBOX'], ['SNOOZED']);
    expect(isDurableLabelMutation(unsnooze.providerAdd, unsnooze.providerRemove)).toBe(true);
    expect(unsnooze.syntheticRemove).toEqual(['SNOOZED']);
    const unknown = splitLabelMutation(['Work', 'SNOOZED'], ['Label_123']);
    expect(unknown.providerAdd).toEqual(['Work']);
    expect(isDurableLabelMutation(unknown.providerAdd, unknown.providerRemove)).toBe(false);
  });
  it('records Gmail implicit inbox removal without mutating caller arrays', () => {
    for (const label of ['TRASH', 'SPAM']) {
      const add = [label, 'INBOX'];
      const remove = ['Label_123'];
      expect(normalizeDurableLabelMutation(add, remove)).toEqual({
        addLabels: [label],
        removeLabels: ['Label_123', 'INBOX'],
      });
      expect(add).toEqual([label, 'INBOX']);
      expect(remove).toEqual(['Label_123']);
    }
  });
  it('routes reversible system moves and custom-label combinations together', () => {
    expect(isDurableLabelMutation(['TRASH'], ['INBOX', 'SPAM'])).toBe(true);
    expect(isDurableLabelMutation(['SPAM'], ['TRASH', 'INBOX'])).toBe(true);
    expect(isDurableLabelMutation(['INBOX'], ['TRASH', 'SPAM'])).toBe(true);
    expect(isDurableLabelMutation(['IMPORTANT', 'Label_123'], ['Label_456'])).toBe(true);
  });

  it('keeps synthetic names, immutable labels and mixed operations out of the provider-ID outbox', () => {
    for (const label of ['SNOOZED', 'DRAFT', 'SENT', 'Work', 'Label_', 'Label_123/Work']) {
      expect(isDurableLabelMutation([label], ['INBOX'])).toBe(false);
      expect(isDurableLabelMutation(['Label_123'], [label])).toBe(false);
    }
    expect(isDurableLabelMutation([], [])).toBe(false);
  });
});
