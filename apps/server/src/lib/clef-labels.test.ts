import { buildLabelRequest, pickLabels } from './clef-labels';
import { describe, expect, it } from 'vitest';

const labels = [
  { name: 'Finance', usecase: 'Invoices, receipts, bank statements' },
  { name: 'Travel', usecase: 'Flights and hotels' },
  { name: 'finance', usecase: 'duplicate with different case' },
  { name: 'Hiring', usecase: '' },
  { name: 'Legal', usecase: 'Contracts' },
];

describe('clef label selection', () => {
  it('asks one yes/no question per distinct label with positional ids', () => {
    const request = buildLabelRequest('Invoice #42 from Acme', labels, ['Work']);
    expect(request?.model).toBe('clef');
    expect(request?.state).toEqual({ summary: 'Invoice #42 from Acme', currentLabels: ['Work'] });
    expect(Object.keys(request!.questions)).toEqual(['label_0', 'label_1', 'label_2', 'label_3']);
    expect(request!.questions.label_0.type).toBe('noul');
    expect(request!.questions.label_0.instructions).toContain('Invoices, receipts');
    expect(request!.questions.label_2.instructions).not.toContain('This label is for');
  });

  it('skips the model when there is nothing to decide', () => {
    expect(buildLabelRequest('  ', labels, [])).toBeNull();
    expect(buildLabelRequest('summary', [], [])).toBeNull();
  });

  it('keeps confident labels, highest first, capped at three', () => {
    const picked = pickLabels(labels, {
      answers: {
        label_0: { type: 'noul', noul: 0.7 },
        label_1: { type: 'noul', noul: 0.2 },
        label_2: { type: 'noul', noul: 0.95 },
        label_3: { type: 'noul', noul: 0.5 },
      },
    });
    expect(picked).toEqual(['Hiring', 'Finance', 'Legal']);
    expect(
      pickLabels(labels, { answers: { label_0: { type: 'noul', noul: 0.9 } } }, 0.5, 1),
    ).toEqual(['Finance']);
  });

  it('tolerates missing or malformed answers', () => {
    expect(pickLabels(labels, undefined)).toEqual([]);
    expect(pickLabels(labels, { answers: { label_0: { type: 'noul', noul: 'yes' } } })).toEqual([]);
  });
});
