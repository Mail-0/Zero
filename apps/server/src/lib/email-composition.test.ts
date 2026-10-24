import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { tools } from '../routes/agent/tools';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { Tools } from '../types';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  compose: vi.fn(),
  preferences: '',
  ownerLookup: vi.fn(),
}));
vi.mock('../db', () => ({ createDb: () => ({ db: state.db, conn: { end: async () => {} } }) }));
vi.mock('../env', () => ({ env: { HYPERDRIVE: { connectionString: 'unused' } } }));
vi.mock('../trpc/routes/ai/compose', () => ({ composeEmail: state.compose }));
vi.mock('./server-utils', () => ({
  getZeroAgent: vi.fn(),
  getZeroDB: async (userId: string) => {
    state.ownerLookup(userId);
    return { findUserSettings: async () => ({ settings: { customPrompt: state.preferences } }) };
  },
}));
vi.mock('./context-dev', () => ({ searchWeb: vi.fn() }));
vi.mock('./ai-models', () => ({ miniModel: vi.fn() }));
vi.mock('./thread-short-summary', () => ({
  getShortThreadSummary: vi.fn(),
  shortSummaryDepsFromEnv: vi.fn(),
}));

const pg = new PGlite();
beforeAll(async () => {
  state.db = drizzle(pg);
  await pg.exec(`CREATE TABLE mail0_user (id text PRIMARY KEY, name text NOT NULL, custom_prompt text);
    CREATE TABLE mail0_connection (id text PRIMARY KEY, user_id text REFERENCES mail0_user(id), name text, email text);`);
});
beforeEach(async () => {
  state.compose.mockReset().mockResolvedValue('Hi!');
  state.preferences = '';
  state.ownerLookup.mockClear();
  await pg.exec(`TRUNCATE mail0_user CASCADE;
    INSERT INTO mail0_user (id,name) VALUES ('alice', 'Alice Owner'), ('bob', 'Bob Owner');
    INSERT INTO mail0_connection VALUES ('alice-personal', 'alice', 'Alice Personal', 'alice@zero.test'),
      ('alice-work', 'alice', 'Alice Work', 'work@zero.test'), ('bob-mail', 'bob', 'Bob Mailbox', 'bob@zero.test');`);
});
afterAll(() => pg.close());

async function compose(
  connectionId: string,
  input: Record<string, unknown> = { prompt: 'Say hi' },
) {
  const tool = (await tools(connectionId, true))[Tools.ComposeEmail];
  const args = tool.parameters.parse(input);
  return tool.execute!(args, { toolCallId: 'compose-test', messages: [], abortSignal: undefined });
}

describe('email composition sender identity', () => {
  it('uses the selected mailbox name, never an assistant identity or another mailbox', async () => {
    expect(await compose('alice-work')).toEqual({
      newBody: 'Hi!',
      sender: { name: 'Alice Work', email: 'work@zero.test' },
    });
    expect(state.compose).toHaveBeenCalledExactlyOnceWith({
      prompt: 'Say hi',
      connectionId: 'alice-work',
      username: 'Alice Work',
    });
  });

  it('falls back to the mailbox owner name when the mailbox name is blank', async () => {
    await pg.exec(`UPDATE mail0_connection SET name = '  ' WHERE id = 'alice-personal';`);
    await compose('alice-personal');
    expect(state.compose).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'Alice Owner' }),
    );
  });

  it('does not invent a name when neither mailbox nor owner has one', async () => {
    await pg.exec(`UPDATE mail0_connection SET name = NULL WHERE id = 'alice-personal';
      UPDATE mail0_user SET name = '' WHERE id = 'alice';`);
    await compose('alice-personal');
    expect(state.compose).toHaveBeenCalledWith(expect.objectContaining({ username: '' }));
  });

  it('does not let model arguments override the server-resolved sender identity', async () => {
    await compose('alice-personal', {
      prompt: 'Say hi',
      username: 'Wrong Person',
      connectionId: 'bob-mail',
    });
    expect(state.compose).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'alice-personal', username: 'Alice Personal' }),
    );
  });

  it('does not generate content for a mailbox that no longer exists', async () => {
    await expect(compose('missing-mailbox')).rejects.toThrow('Mailbox unavailable');
    expect(state.compose).not.toHaveBeenCalled();
  });
  it('loads persistent writing preferences from the selected mailbox owner', async () => {
    state.preferences = 'Always sign off as Cheers, Ally';
    await compose('alice-work');
    expect(state.ownerLookup).toHaveBeenCalledExactlyOnceWith('alice');
    expect(state.compose).toHaveBeenCalledWith(
      expect.objectContaining({ writingInstructions: state.preferences }),
    );
  });
  it('uses the legacy owner preference only when settings have no writing preference', async () => {
    await pg.exec(`UPDATE mail0_user SET custom_prompt = 'Keep emails short' WHERE id = 'alice';`);
    await compose('alice-work');
    expect(state.compose).toHaveBeenCalledWith(
      expect.objectContaining({ writingInstructions: 'Keep emails short' }),
    );
  });
});
