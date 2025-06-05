import { createContext, useContext, useEffect, useState } from 'react';
import { toolExecutors } from '@/lib/elevenlabs-tools';
import { useConversation } from '@elevenlabs/react';
import { useSession } from '@/lib/auth-client';
import type { ReactNode } from 'react';

interface VoiceContextType {
  status: string;
  isInitializing: boolean;
  isSpeaking: boolean;
  hasPermission: boolean;
  errorMessage: string;
  lastToolCall: string | null;
  isOpen: boolean;

  startConversation: (context?: any) => Promise<void>;
  endConversation: () => Promise<void>;
  requestPermission: () => Promise<void>;
  sendContext: (context: any) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastToolCall, setLastToolCall] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [currentContext, setCurrentContext] = useState<any>(null);

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
    onConnect: () => {
      setIsInitializing(false);
      // TODO: Send initial context if available when API supports it
    },
    onDisconnect: () => {
      setIsInitializing(false);
      setLastToolCall(null);
    },
    onError: (error: string | Error) => {
      setErrorMessage(typeof error === 'string' ? error : error.message);
      setIsInitializing(false);
    },
    clientTools: {
      ...Object.entries(toolExecutors).reduce(
        (acc, [name, executor]) => ({
          ...acc,
          [name]: async (params: any) => {
            console.log(`[Voice Tool] ${name} called with params:`, params);
            setLastToolCall(`Executing: ${name}`);

            const paramsWithContext = {
              ...params,
              _context: currentContext,
            };

            const result = await executor(paramsWithContext);
            console.log(`[Voice Tool] ${name} result:`, result);
            setLastToolCall(null);
            return result;
          },
        }),
        {},
      ),
    },
  });

  const { status, isSpeaking } = conversation;

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      setErrorMessage('');
    } catch {
      setErrorMessage('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const startConversation = async (context?: any) => {
    if (!hasPermission) {
      await requestPermission();
      if (!hasPermission) return;
    }

    try {
      setIsInitializing(true);
      setErrorMessage('');
      if (context) {
        setCurrentContext(context);
      }

      const agentId = import.meta.env.VITE_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!agentId) throw new Error('ElevenLabs Agent ID not configured');

      await conversation.startSession({
        agentId: agentId,
        dynamicVariables: {
          user_name: session?.user.name.split(' ')[0] || 'User',
          user_email: session?.user.email || '',
          current_time: new Date().toLocaleString(),
          has_open_email: context?.hasOpenEmail ? 'yes' : 'no',
          current_thread_id: context?.currentThreadId || 'none',
          email_context_info: context?.hasOpenEmail
            ? `The user currently has an email open (thread ID: ${context.currentThreadId}). When the user refers to "this email" or "the current email", you can use the getEmail or summarizeEmail tools WITHOUT providing a threadId parameter - the tools will automatically use the currently open email.`
            : 'No email is currently open. If the user asks about an email, you will need to ask them to open it first or provide a specific thread ID.',
          ...(context || {}),
        },
      });

      setOpen(true);
    } catch {
      setErrorMessage('Failed to start conversation. Please try again.');
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setCurrentContext(null);
    } catch {
      setErrorMessage('Failed to end conversation');
    }
  };

  const sendContext = (context: any) => {
    setCurrentContext(context);
  };

  const value: VoiceContextType = {
    status,
    isInitializing,
    isSpeaking,
    hasPermission,
    errorMessage,
    lastToolCall,
    isOpen,
    startConversation,
    endConversation,
    requestPermission: requestPermission,
    sendContext,
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}

export { VoiceContext };
