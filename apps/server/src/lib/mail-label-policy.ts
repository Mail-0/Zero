// Only provider label IDs enter the outbox. Synthetic app labels and label names
// still require their existing resolution/provider-specific paths.
const durableLabels = new Set(['UNREAD', 'INBOX', 'STARRED', 'TRASH', 'SPAM', 'IMPORTANT']);

export function isSyntheticLabel(label: string) {
  return label === 'SNOOZED' || label === 'MUTE';
}

export function splitLabelMutation(add: string[], remove: string[]) {
  return {
    providerAdd: add.filter((label) => !isSyntheticLabel(label)),
    providerRemove: remove.filter((label) => !isSyntheticLabel(label)),
    syntheticAdd: add.filter(isSyntheticLabel),
    syntheticRemove: remove.filter(isSyntheticLabel),
  };
}

export function isDurableLabelMutation(add: string[], remove: string[]) {
  const labels = [...add, ...remove];
  return (
    labels.length > 0 &&
    labels.every((label) => durableLabels.has(label) || /^Label_[A-Za-z0-9_-]+$/.test(label))
  );
}

export function normalizeDurableLabelMutation(add: string[], remove: string[]) {
  // Gmail removes INBOX implicitly when moving mail to trash or spam. Persist
  // that removal too, so a later restore cannot be mistaken for a local no-op.
  const leavesInbox = add.includes('TRASH') || add.includes('SPAM');
  return {
    addLabels: [...new Set(leavesInbox ? add.filter((label) => label !== 'INBOX') : add)],
    removeLabels: [...new Set(leavesInbox ? [...remove, 'INBOX'] : remove)],
  };
}
