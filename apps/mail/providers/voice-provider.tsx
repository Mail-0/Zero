import { createContext, useContext, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
// import { callServerTool } from '@/lib/server-tool';
import { useSession } from '@/lib/auth-client';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

interface VoiceContextType {
  status: string;
  isInitializing: boolean;
  isSpeaking: boolean;
  hasPermission: boolean;
  lastToolCall: string | null;
  isOpen: boolean;

  startConversation: (context?: any) => Promise<void>;
  endConversation: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  sendContext: (context: any) => void;
}

// const toolNames = [
//   'listEmails',
//   'getEmail',
//   'sendEmail',
//   'markAsRead',
//   'markAsUnread',
//   'archiveEmails',
//   'deleteEmails',
//   'deleteEmail',
//   'createLabel',
//   'applyLabel',
//   'removeLabel',
//   'searchEmails',
//   'webSearch',
//   'summarizeEmail',
// ] as const;

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [lastToolCall, setLastToolCall] = useState<string | null>(null);
  const [isOpen, setOpen] = useState(false);
  const [, setCurrentContext] = useState<any>(null);

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
      toast.error(typeof error === 'string' ? error : error.message);
      setIsInitializing(false);
    },
    // clientTools: toolNames.reduce(
    //   (acc, name) => {
    //     acc[name] = async (params: any) => {
    //       console.log(`[Voice Tool] ${name} called with params:`, params);
    //       setLastToolCall(`Executing: ${name}`);

    //       try {
    //         const result = await callServerTool(
    //           name,
    //           { ...params, _context: currentContext },
    //           session?.user.phoneNumber ?? session?.user.email ?? '',
    //         );

    //         console.log(`[Voice Tool] ${name} result:`, result);
    //         setLastToolCall(null);
    //         return result;
    //       } catch (err) {
    //         setLastToolCall(null);
    //         toast.error(`Tool "${name}" failed: ${(err as Error).message}`);
    //         throw err;
    //       }
    //     };
    //     return acc;
    //   },
    //   {} as Record<string, (params: any) => Promise<any>>,
    // ),
  });

  const { status, isSpeaking } = conversation;

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      return true;
    } catch {
      toast.error('Microphone access denied. Please enable microphone permissions.');
      setHasPermission(false);
      return false;
    }
  };

  const startConversation = async (context?: any) => {
    if (!hasPermission) {
      const result = await requestPermission();
      if (!result) return;
      setHasPermission(result);
    }

    try {
      setIsInitializing(true);
      if (context) {
        setCurrentContext(context);
      }

      const agentId = import.meta.env.VITE_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!agentId) throw new Error('ElevenLabs Agent ID not configured');

      await conversation.startSession({
        agentId: agentId,
        onMessage: (message) => {
          // TODO: Handle message, ideally send it to ai chat agent or show it somewhere on the screen?
          console.log('message', message);
        },
        dynamicVariables: {
          user_name: session?.user.name.split(' ')[0] || 'User',
          user_email: session?.user.email || '',
          current_time: new Date().toLocaleString(),
          has_open_email: context?.hasOpenEmail ? 'yes' : 'no',
          current_thread_id: context?.currentThreadId || 'none',
          email_context_info: context?.hasOpenEmail
            ? `The user currently has an email open (thread ID: ${context.currentThreadId}). When the user refers to "this email" or "the current email", you can use the getEmail or summarizeEmail tools WITHOUT providing a threadId parameter - the tools will automatically use the currently open email.`
            : 'No email is currently open. If the user asks about an email, you will need to ask them to open it first or provide a specific thread ID.',
          ...context,
        },
      });

      setOpen(true);
    } catch {
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  const endConversation = async () => {
    try {
      await conversation.endSession();
      setCurrentContext(null);
    } catch {
      toast.error('Failed to end conversation');
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
