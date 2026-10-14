import {
  BookDashedIcon,
  GitBranchPlus,
  MessageSquareIcon,
  RefreshCcwDotIcon,
  RotateCcwIcon,
  SendIcon,
} from 'lucide-react';
import {
  SummarizeMessage,
  SummarizeThread,
  ReSummarizeThread,
} from '../../../server/src/lib/brain.fallback.prompts';
import { PaneFooter, SectionHeader, hairline, primaryButton, subtleButton, surface } from './ui';
import { AiChatPrompt, StyledEmailAssistantSystemPrompt } from '@/lib/prompts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { EPrompts } from '../../../server/src/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const isPromptValid = (prompt: string): boolean => {
  const trimmed = prompt.trim();
  return trimmed !== '' && trimmed.toLowerCase() !== 'undefined';
};

const initialValues: Record<EPrompts, string> = {
  [EPrompts.Chat]: '',
  [EPrompts.Compose]: '',
  [EPrompts.SummarizeThread]: '',
  [EPrompts.ReSummarizeThread]: '',
  [EPrompts.SummarizeMessage]: '',
};

const fallbackPrompts = {
  [EPrompts.Chat]: AiChatPrompt(),
  [EPrompts.Compose]: StyledEmailAssistantSystemPrompt(),
  [EPrompts.SummarizeThread]: SummarizeThread,
  [EPrompts.ReSummarizeThread]: ReSummarizeThread,
  [EPrompts.SummarizeMessage]: SummarizeMessage,
};

const PROMPTS: { key: EPrompts; label: string; icon: typeof SendIcon; description: string }[] = [
  {
    key: EPrompts.Chat,
    label: 'Chat',
    icon: MessageSquareIcon,
    description: 'Used by the chat sidebar agent. The agent has multiple tools available.',
  },
  {
    key: EPrompts.Compose,
    label: 'Compose',
    icon: SendIcon,
    description: 'Used to compose emails that sound like you.',
  },
  {
    key: EPrompts.SummarizeThread,
    label: 'Summarize thread',
    icon: BookDashedIcon,
    description: 'Takes the entire thread and its key information and summarizes it.',
  },
  {
    key: EPrompts.ReSummarizeThread,
    label: 'Re-summarize thread',
    icon: RefreshCcwDotIcon,
    description: 'Used when a thread’s messages change and a fresh summary is needed.',
  },
  {
    key: EPrompts.SummarizeMessage,
    label: 'Summarize message',
    icon: BookDashedIcon,
    description: 'Takes a single message and summarizes it.',
  },
];

/** Editor for the per-connection AI system prompts. */
export function PromptsEditor() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: prompts } = useQuery(trpc.brain.getPrompts.queryOptions());
  const [active, setActive] = useState<EPrompts>(EPrompts.Chat);

  const { mutateAsync: updatePrompt, isPending: isSavingPrompt } = useMutation(
    trpc.brain.updatePrompt.mutationOptions({
      onSuccess: () => {
        toast.success('Prompt updated');
        queryClient.invalidateQueries({ queryKey: trpc.brain.getPrompts.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message ?? 'Failed to update prompt');
      },
    }),
  );

  const mappedValues = useMemo(() => {
    if (!prompts) return initialValues;
    return Object.fromEntries(
      Object.keys(initialValues).map((key) => [
        key,
        isPromptValid(prompts[key as EPrompts] ?? '')
          ? prompts[key as EPrompts]
          : fallbackPrompts[key as EPrompts],
      ]),
    ) as Record<EPrompts, string>;
  }, [prompts]);

  const { register, getValues, setValue, watch, resetField, formState } = useForm<
    Record<EPrompts, string>
  >({
    defaultValues: initialValues,
    values: mappedValues,
    // Saving one prompt refetches all of them; keep unsaved edits in the others.
    resetOptions: { keepDirtyValues: true },
  });

  const onSave = async () => {
    const content = getValues(active);
    const saved = await updatePrompt({ promptType: active, content }).then(
      () => true,
      () => false,
    );
    if (saved) resetField(active, { defaultValue: content });
  };

  const current = PROMPTS.find((prompt) => prompt.key === active)!;
  const value = watch(active) ?? '';
  const isDirty = !!formState.dirtyFields[active];
  const isDefault = value === fallbackPrompts[active];
  const isCustomized = (key: EPrompts) =>
    !!prompts && isPromptValid(prompts[key] ?? '') && prompts[key] !== fallbackPrompts[key];

  return (
    <>
      <SectionHeader
        title="System prompts"
        description="We believe in open source, so our AI system prompts are open too."
        action={
          <Link
            to="https://github.com/Mail-0/Zero.git"
            target="_blank"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[13px] transition-colors"
          >
            <GitBranchPlus className="size-3.5" />
            Contribute
          </Link>
        }
      />

      <div role="tablist" aria-label="Prompt" className="flex flex-wrap gap-1.5">
        {PROMPTS.map(({ key, label, icon: Icon }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(key)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors',
                'focus-visible:ring-1 focus-visible:ring-[#006FFE]/60 focus-visible:outline-none',
                selected
                  ? 'text-foreground border-[#D4D4D4] bg-white dark:border-[#3A3A3A] dark:bg-[#313131]'
                  : cn(
                      'text-muted-foreground hover:text-foreground bg-transparent hover:bg-[#F5F5F5] dark:hover:bg-[#202020]',
                      hairline,
                    ),
              )}
            >
              <Icon className="size-3.5" />
              {label}
              {(formState.dirtyFields[key] || isCustomized(key)) && (
                <span
                  aria-label={formState.dirtyFields[key] ? 'Unsaved' : 'Customized'}
                  className={cn(
                    'size-1.5 rounded-full',
                    formState.dirtyFields[key] ? 'bg-[#F59E0D]' : 'bg-[#006FFE]',
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className={cn(surface, 'overflow-hidden')}>
        <div
          className={cn('flex items-center justify-between gap-3 border-b px-3.5 py-2.5', hairline)}
        >
          <p className="text-muted-foreground text-[13px] leading-snug">{current.description}</p>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {value.length.toLocaleString()} chars
          </span>
        </div>
        {prompts ? (
          <textarea
            key={active}
            aria-label={`${current.label} prompt`}
            spellCheck={false}
            className="text-foreground block min-h-[300px] w-full resize-y bg-white px-3.5 py-3 font-mono text-[12.5px] leading-relaxed focus:outline-none dark:bg-[#1A1A1A]"
            {...register(active)}
          />
        ) : (
          <div className="space-y-2 bg-white p-3.5 dark:bg-[#1A1A1A]">
            {[92, 80, 86, 64, 74, 40].map((width) => (
              <Skeleton key={width} className="h-3" style={{ width: `${width}%` }} />
            ))}
          </div>
        )}
      </div>

      <PaneFooter hint={isDirty ? 'You have unsaved changes' : undefined}>
        <Button
          variant="outline"
          className={subtleButton}
          disabled={isSavingPrompt || !prompts || isDefault}
          onClick={() => setValue(active, fallbackPrompts[active], { shouldDirty: true })}
        >
          <RotateCcwIcon className="size-3.5" />
          Reset to default
        </Button>
        {isDirty && (
          <Button
            variant="ghost"
            className="h-8 rounded-lg px-3 text-[13px] font-normal"
            disabled={isSavingPrompt}
            onClick={() => resetField(active)}
          >
            Discard
          </Button>
        )}
        <Button
          className={primaryButton}
          disabled={isSavingPrompt || !prompts || !isDirty}
          onClick={onSave}
        >
          {isSavingPrompt ? 'Saving…' : 'Save prompt'}
        </Button>
      </PaneFooter>
    </>
  );
}
