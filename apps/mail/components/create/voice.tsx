'use client';

import React, { useEffect, useState, useMemo } from 'react';

// ElevenLabs
import { useConversation } from '@11labs/react';

// UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Volume2, VolumeX, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Auth
import { trpcClient } from '@/providers/query-provider';
import { useThreads } from '@/hooks/use-threads';
import { useSession } from '@/lib/auth-client';
import type { Sender } from '@/types';
import dedent from 'dedent';

interface EmailContent {
  metadata: {
    isUnread: boolean;
    totalReplies: number;
    tags: string[];
    receivedOn: string;
    importance: 'high' | 'normal';
  };
  content: string;
}

interface VoiceChatProps {
  onClose?: () => void;
}

const VoiceChat = ({ onClose }: VoiceChatProps) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { data: session } = useSession();
  const userName = session?.user.name || 'User';
  const [{ error: threadsError }, threads] = useThreads();
  const [emailContent, setEmailContent] = useState<string[]>([]);

  // Fetch thread content for each thread
  useEffect(() => {
    if (!threads || threads.length === 0) return;
    if (threadsError) {
      setErrorMessage('Failed to load email threads');
      return;
    }

    const fetchThreadContents = async () => {
      try {
        const threadContents = await Promise.all(
          threads.slice(0, 20).map(async (thread) => {
            try {
              const data = await trpcClient.mail.get.query({ id: thread.id });
              if (!data.messages?.length) return null;

              const latestMessage = data.messages[data.messages.length - 1]!;
              return dedent`
              [Email Context]
              Subject: ${latestMessage.subject}
              From: ${latestMessage.sender.name}
              To: ${latestMessage.to.map((t: Sender) => t.name).join(', ')}
              Content: ${latestMessage.body}

              Metadata:
              - Status: ${data.hasUnread ? 'Unread' : 'Read'}
              - Replies: ${data.totalReplies}
              - Tags: ${(latestMessage.tags || []).join(', ')}
              - Importance: ${(latestMessage.tags || []).find((tag) => tag.name === 'important') ? 'high' : 'normal'}
              - Received: ${new Date(latestMessage.receivedOn).toLocaleString()}
              -------------------
            `;
            } catch (error) {
              console.error('Error fetching thread:', error);
              return null;
            }
          }),
        );

        const validContents = threadContents.filter(Boolean) as string[];
        setEmailContent(validContents);
      } catch (error) {
        console.error('Error fetching threads:', error);
        setErrorMessage('Failed to load email content');
      }
    };

    fetchThreadContents();
  }, [threads, threadsError]);

  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
    },
    onMessage: (message) => {
      console.log('Received message:', message);
    },
    onError: (error: string | Error) => {
      setErrorMessage(typeof error === 'string' ? error : error.message);
      console.error('Error:', error);
    },
  });

  const { status, isSpeaking } = conversation;

  useEffect(() => {
    // Request microphone permission on component mount
    const requestMicPermission = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasPermission(true);
      } catch (error) {
        setErrorMessage('Microphone access denied');
        console.error('Error accessing microphone:', error);
      }
    };

    requestMicPermission();
  }, []);

  const handleStartConversation = async () => {
    try {
      const emailContext = emailContent.join('\n\n');

      const conversationId = await conversation.startSession({
        agentId: process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID!,
        dynamicVariables: {
          user_name: userName,
          email_context: emailContext,
        },
      });
      console.log('Started conversation:', conversationId);
    } catch (error) {
      setErrorMessage('Failed to start conversation');
      console.error('Error starting conversation:', error);
    }
  };

  const handleEndConversation = async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      setErrorMessage('Failed to end conversation');
      console.error('Error ending conversation:', error);
    }
  };

  const toggleMute = async () => {
    try {
      await conversation.setVolume({ volume: isMuted ? 1 : 0 });
      setIsMuted(!isMuted);
    } catch (error) {
      setErrorMessage('Failed to change volume');
      console.error('Error changing volume:', error);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Voice Chat
          <div className="flex gap-2">
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-muted h-8 w-8 rounded-full"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleMute}
              disabled={status !== 'connected'}
              className="h-8 w-8 rounded-full"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-center">
            {status === 'connected' ? (
              <Button variant="destructive" onClick={handleEndConversation} className="w-full">
                <MicOff className="mr-2 h-4 w-4" />
                End Conversation
              </Button>
            ) : (
              <Button
                onClick={handleStartConversation}
                disabled={!hasPermission}
                className="w-full"
              >
                <Mic className="mr-2 h-4 w-4" />
                Start Conversation
              </Button>
            )}
          </div>

          <div className="text-center text-sm">
            {status === 'connected' && (
              <p className="text-green-600">
                {isSpeaking ? 'Agent is speaking...' : 'Listening...'}
              </p>
            )}
            {errorMessage && <p className="text-red-500">{errorMessage}</p>}
            {!hasPermission && (
              <p className="text-yellow-600">Please allow microphone access to use voice chat</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceChat;
