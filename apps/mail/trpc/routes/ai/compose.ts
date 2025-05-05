import {
  getWritingStyleMatrixForConnectionId,
  type WritingStyleMatrix,
} from '@/services/writing-style-service';
import { StyledEmailAssistantSystemPrompt } from '@/lib/prompts';
import { activeConnectionProcedure } from '@/trpc/trpc';
import { stripHtml } from 'string-strip-html';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';

export const compose = activeConnectionProcedure
  .input(
    z.object({
      prompt: z.string(),
      emailSubject: z.string().optional(),
      to: z.array(z.string()).optional(),
      cc: z.array(z.string()).optional(),
      threadMessages: z
        .array(
          z.object({
            from: z.string(),
            to: z.array(z.string()),
            cc: z.array(z.string()).optional(),
            subject: z.string(),
            body: z.string(),
          }),
        )
        .optional()
        .default([]),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const { session, activeConnection } = ctx;
    const { prompt, threadMessages, cc, emailSubject, to } = input;
    const writingStyleMatrix = await getWritingStyleMatrixForConnectionId(activeConnection.id);

    console.log('writing', writingStyleMatrix);

    const systemPrompt = StyledEmailAssistantSystemPrompt();

    const userPrompt = EmailAssistantPrompt({
      currentSubject: emailSubject,
      recipients: [...(to ?? []), ...(cc ?? [])],
      prompt,
      username: session.user.name,
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

    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
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
  });

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

const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

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
