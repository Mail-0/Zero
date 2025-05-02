'use server';

import {
  getWritingStyleMatrixForConnectionId,
  type WritingStyleMatrix,
} from '@/services/writing-style-service';
import { StyledEmailAssistantSystemPrompt } from '@/actions/ai-composer-prompt';
import type { Message } from '@microsoft/microsoft-graph-types';
import { stripHtml } from 'string-strip-html';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { generateText } from 'ai';
import { getAIModel } from '@/lib/ai-providers';

export const aiCompose = async ({
  prompt,
  emailSubject,
  to,
  cc,
  threadMessages = [],
}: {
  prompt: string;
  emailSubject?: string;
  to?: string[];
  cc?: string[];
  threadMessages?: {
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    body: string;
  }[];
}) => {
  const session = await getUser();

  const writingStyleMatrix = await getWritingStyleMatrixForConnectionId(session.connectionId);

  console.log('writing', writingStyleMatrix);

  const systemPrompt = StyledEmailAssistantSystemPrompt();

  const userPrompt = EmailAssistantPrompt({
    currentSubject: emailSubject,
    recipients: [...(to ?? []), ...(cc ?? [])],
    prompt,
    username: session.username,
    styleProfile: writingStyleMatrix?.style,
  });

  const threadUserMessages = threadMessages.map((message) => {
    return {
      role: 'user',
      content: MessagePrompt({
        ...message,
        body: stripHtml(message.body).result,
      }),
    } as const;
  });

  const model = getAIModel('ollama', 'llava:7b');
  const { text } = await generateText({
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...(threadMessages.length > 0
        ? [
            {
              role: 'user',
              content: "I'm going to give you the current email thread replies one by one.",
            } as const,
            {
              role: 'assistant',
              content: 'Got it. Please proceed with the thread replies.',
            } as const,
            ...threadUserMessages,
            {
              role: 'user',
              content: 'Now, I will give you the prompt to write the email.',
            } as const,
          ]
        : []),
      {
        role: 'user',
        content: 'Now, I will give you the prompt to write the email.',
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    maxTokens: 1_000,
    temperature: 0.35, // controlled creativity
    frequencyPenalty: 0.2, // dampen phrase repetition
    presencePenalty: 0.1, // nudge the model to add fresh info
    maxRetries: 1,
  });

  return {
    newBody: text,
  };
};

const getUser = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('You must be authenticated.');
  }

  if (!session.connectionId) {
    throw new Error('No active connection.');
  }

  return {
    userId: session.user.id,
    username: session.user.name,
    connectionId: session.connectionId,
  };
};

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const MessagePrompt = ({
  from,
  to,
  cc,
  body,
  subject,
}: {
  from: string;
  to: string[];
  cc?: string[];
  body: string;
  subject: string;
}) => {
  const parts: string[] = [];
  parts.push(`From: ${from}`);
  parts.push(`To: ${to.join(', ')}`);
  if (cc && cc.length > 0) {
    parts.push(`CC: ${cc.join(', ')}`);
  }
  parts.push(`Subject: ${subject}`);
  parts.push('');
  parts.push(`Body: ${body}`);

  return parts.join('\n');
};

const EmailAssistantPrompt = ({
  currentSubject,
  recipients,
  prompt,
  username,
  styleProfile,
}: {
  currentSubject?: string;
  recipients?: string[];
  prompt: string;
  username: string;
  styleProfile?: WritingStyleMatrix | null;
}) => {
  const parts: string[] = [];

  parts.push('# Email Composition Task');
  if (styleProfile) {
    parts.push('## Style Profile');
    parts.push(`\`\`\`json
${JSON.stringify(styleProfile, null, 2)}
\`\`\``);
  }

  parts.push('## Email Context');

  if (currentSubject) {
    parts.push('## The current subject is:');
    parts.push(escapeXml(currentSubject));
    parts.push('');
  }

  if (recipients && recipients.length > 0) {
    parts.push('## The recipients are:');
    parts.push(recipients.join('\n'));
    parts.push('');
  }

  parts.push(
    '## This is a prompt from the user that could be empty, a rough email, or an instruction to write an email.',
  );
  parts.push(escapeXml(prompt));
  parts.push('');

  parts.push("##This is the user's name:");
  parts.push(escapeXml(username));
  parts.push('');

  console.log('parts', parts);

  parts.push(
    'Please write an email using this context and instruction. If there are previous messages in the thread use those for more context.',
    'Make sure to examine all context in this conversation to ALWAYS generate some sort of reply.',
    'Do not include ANYTHING other than the body of the email you write.',
  );

  return parts.join('\n\n');
};
