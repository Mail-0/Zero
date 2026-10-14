import {
  asString,
  expandSequenceSet,
  parseResponse,
  readResponseSegments,
  toSequenceSet,
  type DataResponse,
  type ResponseSegment,
} from './parser';
import { ByteReader, type MailSocket } from '../mail-transport/socket';
import { decodeMailboxName, encodeMailboxName } from './utf7';
import { describe, expect, it } from 'vitest';

const line = (text: string): ResponseSegment[] => [{ text }];

const readerFor = (raw: string) => {
  const chunks = [new TextEncoder().encode(raw)];
  const socket: MailSocket = {
    read: async () => chunks.shift() ?? null,
    write: async () => {},
    startTls: async () => socket,
    close: async () => {},
  };
  return new ByteReader(socket);
};

describe('parseResponse', () => {
  it('parses tagged status with response code', () => {
    const response = parseResponse(line('A1 OK [READ-WRITE] SELECT completed'));
    expect(response).toMatchObject({
      kind: 'status',
      tag: 'A1',
      status: 'OK',
      code: { name: 'READ-WRITE', args: [] },
      text: 'SELECT completed',
    });
  });

  it('parses codes with list arguments', () => {
    const response = parseResponse(line('* OK [PERMANENTFLAGS (\\Deleted \\Seen \\*)] Limited'));
    expect(response).toMatchObject({
      code: { name: 'PERMANENTFLAGS', args: [['\\Deleted', '\\Seen', '\\*']] },
    });
  });

  it('parses LIST with quoted names, NIL delimiter and escapes', () => {
    const a = parseResponse(line('* LIST (\\HasNoChildren \\Sent) "/" "Sent \\"Items\\""'));
    expect((a as DataResponse).values).toEqual([
      'LIST',
      ['\\HasNoChildren', '\\Sent'],
      '/',
      'Sent "Items"',
    ]);
    const b = parseResponse(line('* LIST (\\Noselect) NIL INBOX'));
    expect((b as DataResponse).values).toEqual(['LIST', ['\\Noselect'], null, 'INBOX']);
  });

  it('keeps BODY sections as one atom and reads literals as bytes', async () => {
    const reader = readerFor(
      '* 12 FETCH (UID 99 FLAGS (\\Seen) BODY[HEADER.FIELDS (MESSAGE-ID SUBJECT)] {12}\r\nSubject: hi\n BODY[]<0> "x")\r\n',
    );
    const response = parseResponse(await readResponseSegments(reader)) as DataResponse;
    const [seq, word, items] = response.values as [string, string, unknown[]];
    expect(seq).toBe('12');
    expect(word).toBe('FETCH');
    expect(items[0]).toBe('UID');
    expect(items[4]).toBe('BODY[HEADER.FIELDS (MESSAGE-ID SUBJECT)]');
    expect(new TextDecoder().decode(items[5] as Uint8Array)).toBe('Subject: hi\n');
    expect(items[6]).toBe('BODY[]<0>');
    expect(items[7]).toBe('x');
  });

  it('parses continuation and VANISHED', () => {
    expect(parseResponse(line('+ Ready'))).toEqual({ kind: 'continue', text: 'Ready' });
    const vanished = parseResponse(line('* VANISHED (EARLIER) 41,43:45')) as DataResponse;
    expect(vanished.values).toEqual(['VANISHED', ['EARLIER'], '41,43:45']);
    expect(expandSequenceSet(asString(vanished.values[2]))).toEqual([41, 43, 44, 45]);
  });
});

describe('sequence sets', () => {
  it('round-trips', () => {
    expect(toSequenceSet([5, 1, 2, 3, 9, 10, 2])).toBe('1:3,5,9:10');
    expect(expandSequenceSet('1:3,5,9:10')).toEqual([1, 2, 3, 5, 9, 10]);
  });
});

describe('modified UTF-7', () => {
  it('encodes and decodes mailbox names', () => {
    expect(encodeMailboxName('Entwürfe')).toBe('Entw&APw-rfe');
    expect(encodeMailboxName('A&B')).toBe('A&-B');
    expect(decodeMailboxName('Entw&APw-rfe')).toBe('Entwürfe');
    expect(decodeMailboxName('&ZeVnLIqe-')).toBe('日本語');
    expect(decodeMailboxName(encodeMailboxName('Отправленные'))).toBe('Отправленные');
  });
});
