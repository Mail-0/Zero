'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { toolExecutors } from '@/lib/elevenlabs-tools';
import { useConversation } from '@elevenlabs/react';
import { useSession } from '@/lib/auth-client';
import type { ReactNode } from 'react';

interface VoiceContextType {
  // State
  status: string;
  isInitializing: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  hasPermission: boolean;
  errorMessage: string;
  lastToolCall: string | null;
  isOpen: boolean;

  // Actions
  startConversation: (context?: any) => Promise<void>;
  endConversation: () => Promise<void>;
  toggleMute: () => void;
  requestPermission: () => Promise<void>;
  setOpen: (open: boolean) => void;
  sendContext: (context: any) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [hasPermission, setHasPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
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
          user_name: session?.user.name || 'User',
          user_email: session?.user.email || '',
          current_time: new Date().toLocaleString(),
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

  const toggleMute = () => {
    try {
      conversation.setVolume({ volume: isMuted ? 1 : 0 });
      setIsMuted(!isMuted);
    } catch {
      setErrorMessage('Failed to change volume');
    }
  };

  const sendContext = (context: any) => {
    setCurrentContext(context);
    // TODO: Send context to conversation when API supports it
  };

  const value: VoiceContextType = {
    status,
    isInitializing,
    isSpeaking,
    isMuted,
    hasPermission,
    errorMessage,
    lastToolCall,
    isOpen,
    startConversation,
    endConversation,
    toggleMute,
    requestPermission: requestPermission,
    setOpen,
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

// Export VoiceContext for advanced use cases
export { VoiceContext };
