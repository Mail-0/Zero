import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  BookDashedIcon,
  GitBranchPlus,
  MessageSquareIcon,
  RefreshCcwDotIcon,
  SendIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { Paper } from '../icons/icons'; 
import { Textarea } from './textarea';
import { Link } from 'react-router';
import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AiChatPrompt, StyledEmailAssistantSystemPrompt } from '@/lib/prompts';
import { EPrompts } from '../../../server/src/types';
import { useForm } from 'react-hook-form';
import { 
  SummarizeMessage, 
  SummarizeThread, 
  ReSummarizeThread 
} from '../../../server/src/lib/brain.fallback.prompts';

const isPromptValid = (prompt: string): boolean => {
  const trimmed = prompt.trim();
  return trimmed !== '' && trimmed.toLowerCase() !== 'undefined';
};

export function PromptsDialog() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: prompts } = useQuery(trpc.brain.getPrompts.queryOptions());
  
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

  type PromptFormValues = {
    chatPrompt: string;
    composePrompt: string;
    summarizeThread: string;
    reSummarizeThread: string;
    summarizeMessage: string;
  };

  const initialValues: PromptFormValues = {
    chatPrompt: '',
    composePrompt: '',
    summarizeThread: '',
    reSummarizeThread: '',
    summarizeMessage: '',
  };

  const mappedValues = useMemo<PromptFormValues>(() => {
    if (!prompts) return initialValues;

    return {
      chatPrompt: isPromptValid(prompts.Chat ?? '')
        ? prompts.Chat
        : AiChatPrompt('', '', ''),
      composePrompt: isPromptValid(prompts.Compose ?? '')
        ? prompts.Compose
        : StyledEmailAssistantSystemPrompt().trim(),
      summarizeThread: isPromptValid(prompts.SummarizeThread ?? '')
        ? prompts.SummarizeThread
        : SummarizeThread,
      reSummarizeThread: isPromptValid(prompts.ReSummarizeThread ?? '')
        ? prompts.ReSummarizeThread
        : ReSummarizeThread,
      summarizeMessage: isPromptValid(prompts.SummarizeMessage ?? '')
        ? prompts.SummarizeMessage
        : SummarizeMessage,
    };
  }, [prompts]);

  const { register, getValues, setValue } = useForm<PromptFormValues>({
    defaultValues: initialValues,
    values: mappedValues,
  });

  const resetToDefault = (promptType: keyof PromptFormValues) => {
    switch (promptType) {
      case 'chatPrompt':
        setValue('chatPrompt', AiChatPrompt('', '', '').trim());
        break;
      case 'composePrompt':
        setValue('composePrompt', StyledEmailAssistantSystemPrompt().trim());
        break;
      case 'summarizeThread':
        setValue('summarizeThread', SummarizeThread.trim());
        break;
      case 'reSummarizeThread':
        setValue('reSummarizeThread', ReSummarizeThread.trim());
        break;
      case 'summarizeMessage':
        setValue('summarizeMessage', SummarizeMessage.trim());
        break;
    }
  };

  const renderPromptButtons = (promptType: keyof PromptFormValues, enumType: EPrompts) => (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() =>
          updatePrompt({
            promptType: enumType,
            content: getValues(promptType),
          })
        }
        disabled={isSavingPrompt}
      >
        Save
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => resetToDefault(promptType)}
        disabled={isSavingPrompt}
      >
        <RotateCcwIcon className="h-3 w-3 mr-1" />
        Reset to Default
      </Button>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" className="md:h-fit md:px-2 [&>svg]:size-3">
                <Paper className="dark:fill-iconDark fill-iconLight h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Prompts</TooltipContent>
        </Tooltip>
        <DialogContent className="max-w-screen-lg" showOverlay={true}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ZeroAI System Prompts{' '}
              <Link
                to={'https://github.com/Mail-0/Zero.git'}
                target="_blank"
                className="flex items-center gap-1 text-xs underline"
              >
                <span>Contribute</span>
                <GitBranchPlus className="h-4 w-4" />
              </Link>
            </DialogTitle>
            <DialogDescription>
              We believe in Open Source, so we're open sourcing our AI system prompts.
            </DialogDescription>
          </DialogHeader>
          <Tabs className="mt-2">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="chat">
                <MessageSquareIcon className="mr-2 h-4 w-4" /> Chat
              </TabsTrigger>
              <TabsTrigger value="compose">
                <SendIcon className="mr-2 h-4 w-4" /> Compose
              </TabsTrigger>
              <TabsTrigger value="summarizeThread">
                <BookDashedIcon className="mr-2 h-4 w-4" /> Summarize Thread
              </TabsTrigger>
              <TabsTrigger value="reSummarizeThread">
                <RefreshCcwDotIcon className="mr-2 h-4 w-4" /> Re-Summarize Thread
              </TabsTrigger>
              <TabsTrigger value="summarizeMessage">
                <BookDashedIcon className="mr-2 h-4 w-4" /> Summarize Message
              </TabsTrigger>
            </TabsList>
            {prompts ? (
              <TabsContent value="chat" className="space-y-2">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used in the chat sidebar agent. The agent has multiple tools
                  available.
                </span>
                <Textarea
                  className="min-h-60"
                  {...register('chatPrompt')}
                />
                {renderPromptButtons('chatPrompt', EPrompts.Chat)}
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="compose" className="space-y-2">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to compose emails that sound like you.
                </span>
                <Textarea
                  className="min-h-60"
                  {...register('composePrompt')}
                />
                {renderPromptButtons('composePrompt', EPrompts.Compose)}
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="summarizeThread" className="space-y-2">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to summarize threads. It takes the entire thread and
                  key information and summarizes them.
                </span>
                <Textarea
                  className="min-h-60"
                  {...register('summarizeThread')}
                />
                {renderPromptButtons('summarizeThread', EPrompts.SummarizeThread)}
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="reSummarizeThread" className="space-y-2">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to re-summarize threads. It's used when the thread
                  messages change and a new context is needed.
                </span>
                <Textarea
                  className="min-h-60"
                  {...register('reSummarizeThread')}
                />
                {renderPromptButtons('reSummarizeThread', EPrompts.ReSummarizeThread)}
              </TabsContent>
            ) : null}
            {prompts ? (
              <TabsContent value="summarizeMessage" className="space-y-2">
                <span className="text-muted-foreground mb-2 flex gap-2 text-sm">
                  This system prompt is used to summarize messages. It takes a single message and
                  summarizes it.
                </span>
                <Textarea
                  className="min-h-60"
                  {...register('summarizeMessage')}
                />
                {renderPromptButtons('summarizeMessage', EPrompts.SummarizeMessage)}
              </TabsContent>
            ) : null}
          </Tabs>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
