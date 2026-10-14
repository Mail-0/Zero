export interface OriginalAttachment {
  filename: string;
  mimeType: string;
  size: number;
  body: string;
}

/**
 * Choose which of the original message's attachments to carry over on a forward.
 *
 * Attachment ids are not stable (Gmail issues a new one on every fetch), so the client picks
 * attachments by file name and size. Size breaks ties between same-named files; if no size
 * matches, the first unused file with that name is taken. Each original is used at most once,
 * and attachments without content are skipped.
 */
export const pickForwardedAttachments = <T extends OriginalAttachment>(
  original: T[],
  wanted: { filename: string; size?: number }[],
): T[] => {
  const available = original.filter((a) => a.body);
  const used = new Set<T>();
  const picked: T[] = [];
  for (const want of wanted) {
    const candidates = available.filter((a) => !used.has(a) && a.filename === want.filename);
    const match =
      (want.size !== undefined && candidates.find((a) => a.size === want.size)) || candidates[0];
    if (match) {
      used.add(match);
      picked.push(match);
    }
  }
  return picked;
};
