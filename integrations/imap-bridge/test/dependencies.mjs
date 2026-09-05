// Run after npm install. Unlike the unit suite, missing dependencies are a hard failure here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import sanitize from 'sanitize-html';
import { MailService } from '../src/mail.mjs';
import { messageId } from '../src/core.mjs';

test('installed ImapFlow exposes the APIs used by the bridge', () => {
  const client = new ImapFlow({ host: 'localhost', port: 993, secure: true, logger: false, auth: { user: 'test', pass: 'test' } });
  for (const name of ['fetchAll', 'fetchOne', 'getMailboxLock', 'messageFlagsAdd', 'messageFlagsRemove', 'messageMove', 'append']) assert.equal(typeof client[name], 'function');
  client.close();
});
test('Nodemailer builds MIME with an envelope and does not expose Bcc in headers', async () => {
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  try {
    const built = await transport.sendMail({
      envelope: { from: 'a@example.com', to: ['b@example.com', 'hidden@example.com'] },
      from: 'a@example.com', to: 'b@example.com',
      subject: '中文主题', html: '<p>你好</p>', attachments: [{ filename: '测试.txt', content: Buffer.from('附件内容') }],
      disableUrlAccess: true, disableFileAccess: true });
    assert.ok(Buffer.isBuffer(built.message)); assert.ok(built.envelope.to.includes('hidden@example.com'));
    assert.ok(!built.message.toString().includes('Bcc:'));
    const parsed = await simpleParser(built.message);
    assert.equal(parsed.subject, '中文主题'); assert.equal(parsed.attachments[0].content.toString(), '附件内容');
  } finally { transport.close(); }
});
test('real MIME parser and sanitizer remove scripts, images, event attributes, and unsafe links', async () => {
  const source = Buffer.from('From: sender@example.com\r\nTo: owner@example.com\r\nSubject: Safe rendering\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p onclick="alert(1)">Hello</p><script>alert(1)</script><img src="https://tracker.example/pixel"><a href="javascript:alert(1)">click</a>');
  const client = { mailbox: { uidValidity: 1n }, connect: async () => {}, logout: async () => {}, close() {}, on() {},
    getMailboxLock: async () => ({ release() {} }), list: async () => [],
    fetchOne: async (_uid, fields) => fields.source ? { source } : { size: source.length, flags: new Set(), internalDate: new Date(0) } };
  const mail = new MailService({ createImap: () => client, mailer: nodemailer, parseMail: simpleParser, sanitize }, null);
  const thread = await mail.get({}, messageId('INBOX', '1', 1));
  for (const unsafe of ['<script', '<img', 'onclick', 'javascript:', 'tracker.example']) assert.ok(!thread.latest.processedHtml.includes(unsafe));
  assert.ok(thread.latest.processedHtml.includes('Hello'));
});
