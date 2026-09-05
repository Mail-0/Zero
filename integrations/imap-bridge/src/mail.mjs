import { randomUUID } from 'node:crypto';
import { BridgeError, address, dispatchOnce, ensure, headerText, messageId, pageUids, parseMessageId, text } from './core.mjs';

const MAX_SOURCE = 10 * 1024 * 1024;
const SYSTEM_FOLDERS = { inbox: '\\Inbox', sent: '\\Sent', drafts: '\\Drafts', draft: '\\Drafts', spam: '\\Junk', bin: '\\Trash', trash: '\\Trash', archive: '\\Archive' };
const LABELS = { '\\Inbox': 'INBOX', '\\Sent': 'SENT', '\\Drafts': 'DRAFT', '\\Junk': 'SPAM', '\\Trash': 'TRASH', '\\Archive': 'ARCHIVE' };
const addressList = (item) => {
  if (Array.isArray(item)) return item.flatMap(addressList);
  if (item?.value) return addressList(item.value);
  if (item?.address || item?.email) return [{ name: item.name || '', email: item.address || item.email }];
  return [];
};
const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Dependencies are injected so protocol edge cases can be tested without an external mailbox.
export class MailService {
  constructor({ createImap, mailer, parseMail, sanitize }, vault) {
    this.createImap = createImap; this.mailer = mailer; this.parseMail = parseMail;
    this.sanitize = sanitize; this.vault = vault;
  }
  async withClient(account, fn) {
    const client = this.createImap({
      host: account.imapHost, port: 993, secure: true,
      auth: { user: account.username, pass: account.password },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      clientInfo: { name: 'Zero IMAP Bridge', version: '0.1.0', vendor: 'Tippye' },
      logger: false, emitLogs: false, disableAutoIdle: true,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
    });
    client.on?.('error', () => {}); // Operation promises carry errors; never log credentials/source.
    try { await client.connect(); return await fn(client); }
    finally {
      let timer;
      try {
        await Promise.race([
          client.logout().catch(() => {}),
          new Promise((resolve) => { timer = setTimeout(resolve, 2000); timer.unref?.(); }),
        ]);
      } finally { clearTimeout(timer); client.close(); }
    }
  }
  smtp(account) {
    return this.mailer.createTransport({
      host: account.smtpHost, port: account.smtpPort, secure: account.smtpPort === 465,
      requireTLS: account.smtpPort === 587,
      auth: { user: account.smtpUsername, pass: account.smtpPassword },
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      logger: false, debug: false, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
      disableFileAccess: true, disableUrlAccess: true,
    });
  }
  async verify(account) {
    await this.withClient(account, (client) => client.list());
    const transport = this.smtp(account);
    try { await transport.verify(); } finally { transport.close(); }
    return { success: true };
  }
  async folders(client) {
    return (await client.list()).filter((f) => !f.flags?.has('\\Noselect'));
  }
  async resolveFolder(client, input) {
    const requested = headerText(input || 'inbox', 'folder', 1024);
    if (requested === 'INBOX' || requested.toLowerCase() === 'inbox') return 'INBOX';
    const folders = await this.folders(client);
    const specialUse = SYSTEM_FOLDERS[requested.toLowerCase()];
    const found = folders.find((f) => f.path === requested) || (specialUse ? folders.find((f) => f.specialUse === specialUse) : null);
    ensure(found, 'FOLDER_NOT_FOUND', 'Folder not found. Use a folder reported by this account.', 404);
    return found.path;
  }
  async locked(client, folder, validity, fn) {
    const lock = await client.getMailboxLock(folder);
    try {
      if (validity) ensure(String(client.mailbox.uidValidity) === validity, 'STALE_UIDVALIDITY', 'Mailbox was rebuilt. Refresh the folder before changing this message.', 409);
      return await fn();
    } finally { lock.release(); }
  }
  async list(account, input = {}) {
    return this.withClient(account, async (client) => {
      const starred = input.folder === 'starred';
      const folder = await this.resolveFolder(client, starred ? 'inbox' : input.folder);
      return this.locked(client, folder, null, async () => {
        const validity = String(client.mailbox.uidValidity);
        const cursor = input.pageToken ? parseMessageId(input.pageToken) : null;
        if (cursor) ensure(cursor.folder === folder && cursor.validity === validity, 'STALE_CURSOR', 'Folder changed; refresh its first page.', 409);
        const limit = input.maxResults ?? 30;
        ensure(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'INVALID_INPUT', 'Page size must be 1–50');
        if (!client.mailbox.exists || cursor?.uid === 1) return { threads: [], nextPageToken: null };
        const query = { all: true };
        if (starred) query.flagged = true;
        if ((input.labelIds || []).includes('UNREAD')) query.seen = false;
        if ((input.labelIds || []).includes('STARRED')) query.flagged = true;
        ensure((input.labelIds || []).every((id) => ['UNREAD', 'STARRED', 'INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'ARCHIVE'].includes(id)), 'NOT_SUPPORTED', 'Gmail categories/custom labels are not IMAP search filters', 422);
        if (input.query) query.text = text(input.query, 'search text', 512);
        if (cursor) query.uid = `1:${cursor.uid - 1}`;
        const found = await client.search(query, { uid: true });
        const { selected, hasMore } = pageUids(found || [], cursor?.uid, limit);
        if (!selected.length) return { threads: [], nextPageToken: null };
        // Never issue another command from within an ImapFlow fetch() generator.
        const messages = await client.fetchAll(selected.join(','), { uid: true, envelope: true, flags: true, internalDate: true }, { uid: true });
        const byUid = new Map(messages.map((m) => [m.uid, m]));
        return {
          threads: selected.filter((uid) => byUid.has(uid)).map((uid) => ({
            id: messageId(folder, validity, uid), historyId: null,
            $raw: { subject: byUid.get(uid).envelope?.subject || '', uid, folder,
              sender: addressList(byUid.get(uid).envelope?.from).map((a) => a.name || a.email).join(', '),
              receivedOn: new Date(byUid.get(uid).internalDate || byUid.get(uid).envelope?.date || 0).toISOString(),
              unread: !byUid.get(uid).flags?.has('\\Seen'), starred: !!byUid.get(uid).flags?.has('\\Flagged') },
          })),
          nextPageToken: hasMore ? messageId(folder, validity, selected.at(-1)) : null,
        };
      });
    });
  }
  async source(client, uid) {
    const meta = await client.fetchOne(uid, { size: true, flags: true, internalDate: true }, { uid: true });
    ensure(meta, 'MESSAGE_NOT_FOUND', 'Message no longer exists', 404);
    ensure(Number.isFinite(meta.size) && meta.size <= MAX_SOURCE, 'MESSAGE_TOO_LARGE', 'This version supports messages up to 10 MiB', 413);
    const message = await client.fetchOne(uid, { source: true }, { uid: true });
    ensure(message?.source, 'MESSAGE_NOT_FOUND', 'Message no longer exists', 404);
    ensure(message.source.length <= MAX_SOURCE, 'MESSAGE_TOO_LARGE', 'Message exceeds the size limit', 413);
    return { ...meta, source: message.source };
  }
  async get(account, id, raw = false) {
    const { folder, validity, uid } = parseMessageId(id);
    return this.withClient(account, async (client) => this.locked(client, folder, validity, async () => {
      const fetched = await this.source(client, uid);
      if (raw) return fetched.source.toString('utf8');
      const parsed = await this.parseMail(fetched.source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
      const html = this.sanitize(parsed.html || `<pre>${escape(parsed.text || '')}</pre>`, {
        allowedTags: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'hr', 'a'],
        allowedAttributes: { a: ['href'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] },
        allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false,
      });
      const folders = await this.folders(client);
      const special = folder.toUpperCase() === 'INBOX' ? '\\Inbox' : folders.find((f) => f.path === folder)?.specialUse;
      const names = [LABELS[special] || folder];
      if (!fetched.flags?.has('\\Seen')) names.push('UNREAD');
      if (fetched.flags?.has('\\Flagged')) names.push('STARRED');
      if (fetched.flags?.has('\\Draft') && !names.includes('DRAFT')) names.push('DRAFT');
      const tags = names.map((name) => ({ id: name, name, type: 'system' }));
      const attachments = (parsed.attachments || []).map((item, index) => ({
        attachmentId: String(index), filename: item.filename || `attachment-${index}`,
        mimeType: item.contentType || 'application/octet-stream', size: item.size,
        body: item.content.toString('base64'), headers: [],
      }));
      const date = parsed.date || fetched.internalDate || new Date(0);
      const message = {
        id, threadId: id, title: parsed.subject || '(no subject)', subject: parsed.subject || '',
        tags, sender: addressList(parsed.from)[0] || { name: '', email: '' },
        to: addressList(parsed.to), cc: addressList(parsed.cc), bcc: addressList(parsed.bcc),
        tls: true, receivedOn: new Date(date).toISOString(), unread: names.includes('UNREAD'),
        body: Buffer.from(html).toString('base64'), processedHtml: html, decodedBody: html, blobUrl: '',
        messageId: parsed.messageId, inReplyTo: parsed.inReplyTo,
        references: Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references,
        replyTo: addressList(parsed.replyTo)[0]?.email,
        attachments, isDraft: names.includes('DRAFT'),
      };
      // First release treats each IMAP message as one thread. References are retained for future threading.
      return { messages: [message], latest: message, hasUnread: message.unread, totalReplies: 1,
        labels: tags.map(({ id: labelId, name }) => ({ id: labelId, name })) };
    }));
  }
  async getFolders(account) {
    return this.withClient(account, async (client) => (await this.folders(client)).map((f) => ({
      id: f.path, name: f.name || f.path, specialUse: f.specialUse || null, type: 'folder',
    })));
  }
  async modify(account, ids, addLabels = [], removeLabels = []) {
    ensure(Array.isArray(ids) && ids.length > 0 && ids.length <= 100, 'INVALID_INPUT', 'Select 1–100 messages');
    ensure(Array.isArray(addLabels) && Array.isArray(removeLabels), 'INVALID_INPUT', 'Labels must be arrays');
    const supported = ['UNREAD', 'STARRED', 'INBOX', 'TRASH', 'SPAM', 'ARCHIVE'];
    ensure([...addLabels, ...removeLabels].every((label) => supported.includes(label)), 'NOT_SUPPORTED', 'IMAP supports read/star state and folder moves, not Gmail-specific labels', 422);
    const destinationLabels = addLabels.filter((l) => ['INBOX', 'TRASH', 'SPAM', 'ARCHIVE'].includes(l));
    ensure(destinationLabels.length <= 1, 'INVALID_INPUT', 'Choose one destination folder');
    const destinations = { INBOX: 'inbox', TRASH: 'bin', SPAM: 'spam', ARCHIVE: 'archive' };
    return this.withClient(account, async (client) => {
      const destination = destinationLabels.length ? await this.resolveFolder(client, destinations[destinationLabels[0]]) :
        removeLabels.includes('INBOX') ? await this.resolveFolder(client, 'archive') : null;
      for (const id of ids) {
        const { folder, validity, uid } = parseMessageId(id);
        await this.locked(client, folder, validity, async () => {
          if (destination && destination !== folder) ensure(client.capabilities.has('MOVE'), 'NOT_SUPPORTED', 'Server must support atomic IMAP MOVE', 422);
          ensure(await client.fetchOne(uid, { uid: true }, { uid: true }), 'MESSAGE_NOT_FOUND', 'Message no longer exists', 404);
          if (addLabels.includes('UNREAD')) await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
          if (removeLabels.includes('UNREAD')) await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
          if (addLabels.includes('STARRED')) await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
          if (removeLabels.includes('STARRED')) await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
          if (destination && destination !== folder) {
            // MOVE is atomic. Reject copy/delete emulation on servers without MOVE.
            ensure(client.capabilities.has('MOVE'), 'NOT_SUPPORTED', 'This server lacks atomic IMAP MOVE; no copy/delete fallback is performed', 422);
            await client.messageMove(uid, destination, { uid: true });
          }
        });
      }
      return { success: true };
    });
  }
  async move(account, id, destination) {
    const { folder, validity, uid } = parseMessageId(id);
    return this.withClient(account, async (client) => {
      const target = await this.resolveFolder(client, destination);
      return this.locked(client, folder, validity, async () => {
        ensure(client.capabilities.has('MOVE'), 'NOT_SUPPORTED', 'Server must support atomic IMAP MOVE', 422);
        ensure(await client.fetchOne(uid, { uid: true }, { uid: true }), 'MESSAGE_NOT_FOUND', 'Message no longer exists', 404);
        if (target !== folder) await client.messageMove(uid, target, { uid: true });
        return { success: true };
      });
    });
  }
  outgoing(account, data) {
    const recipients = (items = []) => {
      ensure(Array.isArray(items) && items.length <= 100, 'INVALID_INPUT', 'Invalid recipients');
      return items.map((item) => ({ address: address(item.email), name: headerText(item.name || '', 'recipient name', 256, true) }));
    };
    const to = recipients(data.to), cc = recipients(data.cc), bcc = recipients(data.bcc);
    ensure(to.length + cc.length + bcc.length > 0 && to.length + cc.length + bcc.length <= 100, 'INVALID_INPUT', 'Choose 1–100 recipients');
    ensure(!data.fromEmail || data.fromEmail.toLowerCase() === account.email.toLowerCase(), 'INVALID_INPUT', 'From must match the connected mailbox');
    const attachments = data.attachments || [];
    ensure(Array.isArray(attachments) && attachments.length <= 20, 'INVALID_INPUT', 'At most 20 attachments');
    let total = 0;
    const files = attachments.map((file) => {
      const encoded = text(file.base64, 'attachment', 14 * 1024 * 1024, true);
      ensure(/^[a-zA-Z\d+/]*={0,2}$/.test(encoded), 'INVALID_INPUT', 'Attachment must be base64 data, not a URL or path');
      const content = Buffer.from(encoded, 'base64'); total += content.length;
      return { filename: headerText(file.name, 'attachment name', 256).replace(/[/\\]/g, '_'),
        contentType: headerText(file.type || 'application/octet-stream', 'MIME type', 128), content };
    });
    ensure(total <= 8 * 1024 * 1024, 'MESSAGE_TOO_LARGE', 'Total attachments must not exceed 8 MiB', 413);
    const headers = {};
    for (const name of ['In-Reply-To', 'References', 'Reply-To']) {
      const pair = Object.entries(data.headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
      if (pair) headers[name] = headerText(pair[1], name, 2048);
    }
    return {
      // Keep blind recipients in the SMTP envelope only. StreamTransport preserves
      // Bcc headers, so passing `bcc` here would disclose every blind recipient.
      envelope: { from: account.email, to: [...to, ...cc, ...bcc].map((item) => item.address) },
      from: { address: account.email, name: account.name }, to, cc,
      subject: headerText(data.subject || '', 'subject', 998, true),
      html: text(data.message || '', 'message', 1024 * 1024, true), attachments: files, headers,
      messageId: `<${randomUUID()}@${account.email.split('@')[1]}>`,
      disableFileAccess: true, disableUrlAccess: true,
    };
  }
  async send(owner, accountId, account, data) {
    // Validate before writing the idempotency record so invalid input does not block a corrected draft.
    const mail = this.outgoing(account, data);
    const { operationId, ...payload } = data;
    return dispatchOnce(this.vault, owner, accountId, operationId, payload, async () => {
      const builder = this.mailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
      let built;
      try { built = await builder.sendMail(mail); } finally { builder.close(); }
      const transport = this.smtp(account);
      let info;
      try { info = await transport.sendMail({ envelope: built.envelope, raw: built.message, disableFileAccess: true, disableUrlAccess: true }); }
      catch { throw new BridgeError('SEND_UNCERTAIN', 'SMTP did not confirm delivery. Check Sent before attempting to resend.', 409); }
      finally { transport.close(); }
      let sentCopySaved = null;
      if (account.saveSent) {
        try {
          await this.withClient(account, async (client) => {
            const folder = await this.resolveFolder(client, 'sent');
            await client.append(folder, built.message, ['\\Seen']);
          });
          sentCopySaved = true;
        } catch { sentCopySaved = false; }
      }
      return { id: mail.messageId, accepted: (info.accepted || []).map(String),
        rejected: (info.rejected || []).map(String), sentCopySaved };
    });
  }
}
