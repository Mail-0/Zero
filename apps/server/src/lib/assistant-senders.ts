import { AssistantToolError } from './assistant-utils';
import { getZeroAgent } from './server-utils';
import { z } from 'zod';

export async function sendingAddresses(mailbox: { id: string; email: string }) {
  try {
    const aliases = await (await getZeroAgent(mailbox.id)).getEmailAliases();
    const values = new Map<string, { email: string; name?: string; primary: boolean }>();
    values.set(mailbox.email.toLowerCase(), { email: mailbox.email.toLowerCase(), primary: true });
    for (const alias of aliases) {
      const parsed = z.string().trim().email().safeParse(alias.email);
      if (parsed.success)
        values.set(parsed.data.toLowerCase(), {
          email: parsed.data.toLowerCase(),
          name: alias.name,
          primary: alias.primary ?? false,
        });
    }
    return [...values.values()];
  } catch {
    throw new AssistantToolError(
      'Sending addresses could not be verified. Reconnect the mailbox or use the mailbox UI; do not invent a From address.',
      'sending_addresses_unavailable',
    );
  }
}

export async function verifySender(mailbox: { id: string; email: string }, email: string) {
  if (email.toLowerCase() === mailbox.email.toLowerCase()) return mailbox.email;
  const found = (await sendingAddresses(mailbox)).find(
    (alias) => alias.email === email.toLowerCase(),
  );
  if (!found)
    throw new AssistantToolError(
      'From address is not a verified sending address for this mailbox. Use list_sending_addresses or select another owned mailbox.',
      'sender_not_authorized',
    );
  return found.email;
}
