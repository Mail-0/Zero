import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mic, MicOff, Volume2, VolumeX, Mail, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpcClient } from '@/providers/query-provider';
import { toolExecutors } from '@/lib/elevenlabs-tools';
import { useConversation } from '@elevenlabs/react';
import { useThreads } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import dedent from 'dedent';

const LoadingState = () => (
  <div className="container mx-auto p-6">
    <div className="mx-auto flex min-h-[400px] max-w-2xl items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  </div>
);

const AuthRequired = () => (
  <div className="container mx-auto p-6">
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="mb-4 text-2xl font-bold">Authentication Required</h1>
      <p className="text-muted-foreground">Please log in to use the voice assistant.</p>
    </div>
  </div>
);

const EmailStatus = ({ isLoading, threadCount }: { isLoading: boolean; threadCount: number }) => {
  if (isLoading) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Loading your recent emails for context...</AlertDescription>
      </Alert>
    );
  }

  if (threadCount > 0) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          Loaded {threadCount} recent email{threadCount > 1 ? 's' : ''} for context
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

const ConversationStatus = ({
  status,
  isInitializing,
  isSpeaking,
  errorMessage,
  lastToolCall,
}: {
  status: string;
  isInitializing: boolean;
  isSpeaking: boolean;
  errorMessage: string;
  lastToolCall: string | null;
}) => (
  <div className="space-y-3">
    <div className="bg-muted rounded-lg p-4 text-center">
      {status === 'disconnected' && !isInitializing && (
        <p className="text-muted-foreground">Ready to start</p>
      )}
      {isInitializing && (
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-muted-foreground">Initializing voice assistant...</p>
        </div>
      )}
      {status === 'connected' && (
        <div className="space-y-2">
          <p className={`font-medium ${isSpeaking ? 'text-green-600' : 'text-blue-600'}`}>
            {isSpeaking ? 'Assistant is speaking...' : 'Listening...'}
          </p>
          {lastToolCall && (
            <p className="text-muted-foreground text-sm">Last action: {lastToolCall}</p>
          )}
        </div>
      )}
      {errorMessage && <p className="text-destructive mt-2 text-sm">{errorMessage}</p>}
    </div>
  </div>
);

const ConversationControls = ({
  isConnected,
  isInitializing,
  isLoadingThreads,
  isMuted,
  hasPermission,
  onStart,
  onEnd,
  onToggleMute,
  onRequestPermission,
}: {
  isConnected: boolean;
  isInitializing: boolean;
  isLoadingThreads: boolean;
  isMuted: boolean;
  hasPermission: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onRequestPermission: () => void;
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex justify-center gap-4">
      {isConnected ? (
        <>
          <Button variant="destructive" size="lg" onClick={onEnd} className="w-full max-w-xs">
            <MicOff className="mr-2 h-5 w-5" />
            End Conversation
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleMute}
            className="h-12 w-12"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
        </>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          disabled={isInitializing || isLoadingThreads}
          className="w-full max-w-xs"
        >
          {isInitializing ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Mic className="mr-2 h-5 w-5" />
          )}
          Start Conversation
        </Button>
      )}
    </div>

    {!hasPermission && !isConnected && !isInitializing && (
      <Button variant="outline" onClick={onRequestPermission} className="mx-auto w-full max-w-xs">
        Enable Microphone Access
      </Button>
    )}
  </div>
);

const ToolExamples = () => (
  <Card className="border-dashed">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Try saying:</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="text-muted-foreground space-y-2 text-sm">
        <li>• "Show me my latest emails"</li>
        <li>• "Read the email from John about the meeting"</li>
        <li>• "Archive all emails from last week"</li>
        <li>• "Compose an email to Sarah about the project update"</li>
        <li>• "Mark my unread emails as read"</li>
        <li>• "Create a label called Important"</li>
        <li>• "Search for emails about the budget proposal"</li>
      </ul>
    </CardContent>
  </Card>
);

const useEmailContext = (threads: any, threadsError: any) => {
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [emailContext, setEmailContext] = useState<string>('');

  useEffect(() => {
    if (!threads || threads.length === 0) {
      setEmailContext('No recent emails found.');
      return;
    }
    if (threadsError) {
      setEmailContext('Unable to load email threads.');
      return;
    }

    const fetchThreadContents = async () => {
      setIsLoadingThreads(true);
      try {
        const threadContents = await Promise.all(
          threads.slice(0, 10).map(async (thread: any) => {
            try {
              const data = await trpcClient.mail.get.query({ id: thread.id });
              if (!data.messages?.length) return null;

              const latestMessage = data.messages[data.messages.length - 1]!;
              return dedent`
              Thread ID: ${thread.id}
              Subject: ${latestMessage.subject}
              From: ${latestMessage.sender.name} (${latestMessage.sender.email})
              Date: ${new Date(latestMessage.receivedOn).toLocaleString()}
              Status: ${data.hasUnread ? 'Unread' : 'Read'}
              Preview: ${latestMessage.body?.slice(0, 200)}...
              ---
              `;
            } catch {
              return null;
            }
          }),
        );

        const validContents = threadContents.filter(Boolean) as string[];
        setEmailContext(
          validContents.length > 0
            ? `You have access to the following recent emails:\n\n${validContents.join('\n')}`
            : 'No recent emails found.',
        );
      } catch {
        setEmailContext('Failed to load email content.');
      } finally {
        setIsLoadingThreads(false);
      }
    };

    fetchThreadContents();
  }, [threads, threadsError]);

  return { isLoadingThreads, emailContext };
};

export default function VoicePage() {
  const { data: session, isPending } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastToolCall, setLastToolCall] = useState<string | null>(null);
  const [{ error: threadsError }, threads] = useThreads();
  const { isLoadingThreads, emailContext } = useEmailContext(threads, threadsError);

  useEffect(() => {
    if (!session) return;

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setHasPermission(true);
        stream.getTracks().forEach((track) => track.stop());
      })
      .catch(() => setHasPermission(false));
  }, [session]);

  const conversation = useConversation({
    onConnect: () => setIsInitializing(false),
    onDisconnect: () => {
      setIsInitializing(false);
      setLastToolCall(null);
    },
    // onMessage: (message: any) => {
    //   if (message.type === 'tool_call') {
    //     const toolName =
    //       elevenLabsTools.find((t) => t.name === message.tool_name)?.description ||
    //       message.tool_name;
    //     setLastToolCall(toolName);
    //   }
    // },
    onError: (error: string | Error) => {
      setErrorMessage(typeof error === 'string' ? error : error.message);
      setIsInitializing(false);
    },
    clientTools: {
      logMessage: async ({ message }) => {
        console.log(message);
      },
      ...Object.entries(toolExecutors).reduce(
        (acc, [name, executor]) => ({
          ...acc,
          [name]: async (params: any) => {
            console.log('params', params);
            console.log('name', name);
            setLastToolCall(`Executing: ${name}`);
            const result = await executor(params);
            setLastToolCall(null);
            return result;
          },
        }),
        {},
      ),
    },
  });

  const { status, isSpeaking } = conversation;

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const handleStartConversation = async () => {
    if (!hasPermission) {
      await requestMicPermission();
      if (!hasPermission) return;
    }

    try {
      setIsInitializing(true);
      setErrorMessage('');

      const agentId = import.meta.env.VITE_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!agentId) throw new Error('ElevenLabs Agent ID not configured');

      await conversation.startSession({
        agentId: agentId,
        dynamicVariables: {
          user_name: session?.user.name || 'User',
          user_email: session?.user.email || '',
          email_context: emailContext,
          thread_count: threads?.length.toString() || '0',
          current_time: new Date().toLocaleString(),
        },
      });
    } catch {
      setErrorMessage('Failed to start conversation. Please try again.');
    }
  };

  const handleEndConversation = async () => {
    try {
      await conversation.endSession();
    } catch {
      setErrorMessage('Failed to end conversation');
    }
  };

  const toggleMute = async () => {
    try {
      await conversation.setVolume({ volume: isMuted ? 1 : 0 });
      setIsMuted(!isMuted);
    } catch {
      setErrorMessage('Failed to change volume');
    }
  };

  if (isPending) return <LoadingState />;
  if (!session) return <AuthRequired />;

  return (
    <div className="container mx-auto p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Mail className="h-8 w-8" />
          <h1 className="text-3xl font-bold">AI Voice Assistant</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Voice Conversation</CardTitle>
                <CardDescription>
                  Have a natural conversation with your AI email assistant
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <EmailStatus isLoading={isLoadingThreads} threadCount={threads?.length || 0} />

                <ConversationStatus
                  status={status}
                  isInitializing={isInitializing}
                  isSpeaking={isSpeaking}
                  errorMessage={errorMessage}
                  lastToolCall={lastToolCall}
                />

                <ConversationControls
                  isConnected={status === 'connected'}
                  isInitializing={isInitializing}
                  isLoadingThreads={isLoadingThreads}
                  isMuted={isMuted}
                  hasPermission={hasPermission}
                  onStart={handleStartConversation}
                  onEnd={handleEndConversation}
                  onToggleMute={toggleMute}
                  onRequestPermission={requestMicPermission}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <ToolExamples />
          </div>
        </div>
      </div>
    </div>
  );
}
