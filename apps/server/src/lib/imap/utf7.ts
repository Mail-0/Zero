/**
 * IMAP "modified UTF-7" mailbox name encoding (RFC 3501 §5.1.3). Used unless the server
 * accepts UTF-8 (`ENABLE UTF8=ACCEPT`).
 */

const encodeBase64Modified = (units: number[]) => {
  const bytes: number[] = [];
  for (const unit of units) bytes.push(unit >> 8, unit & 0xff);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=+$/, '').replace(/\//g, ',');
};

const decodeBase64Modified = (value: string) => {
  const padded = value.replace(/,/g, '/');
  const binary = atob(padded + '==='.slice((padded.length + 3) % 4));
  let out = '';
  for (let i = 0; i + 1 < binary.length; i += 2)
    out += String.fromCharCode((binary.charCodeAt(i) << 8) | binary.charCodeAt(i + 1));
  return out;
};

export const encodeMailboxName = (name: string): string => {
  let out = '';
  let pending: number[] = [];
  const flush = () => {
    if (!pending.length) return;
    out += `&${encodeBase64Modified(pending)}-`;
    pending = [];
  };
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) {
      flush();
      out += code === 0x26 ? '&-' : name[i];
    } else {
      pending.push(code);
    }
  }
  flush();
  return out;
};

export const decodeMailboxName = (name: string): string =>
  name.replace(/&([^-]*)-/g, (_, chunk: string) =>
    chunk === '' ? '&' : decodeBase64Modified(chunk),
  );
