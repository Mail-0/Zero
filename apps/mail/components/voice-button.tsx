import { Mic, MicOff, Loader2, WavesIcon } from 'lucide-react';
import { ComposerIconButton } from './ai-chat/chat-composer';
import { useVoice } from '@/providers/voice-provider';
import { useSession } from '@/lib/auth-client';
import { useQueryState } from 'nuqs';

export function VoiceButton() {
  const { data: session } = useSession();
  const [threadId] = useQueryState('threadId');
  const { status, isInitializing, isSpeaking, startConversation, endConversation } = useVoice();

  if (!session) return null;

  if (status !== 'connected') {
    return (
      <ComposerIconButton
        title="Talk to Zero"
        onClick={() =>
          startConversation({ hasOpenEmail: !!threadId, currentThreadId: threadId || null })
        }
      >
        <Mic className="size-4" />
      </ComposerIconButton>
    );
  }

  return (
    <ComposerIconButton title="End voice conversation" onClick={endConversation} pressed>
      {isInitializing ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isSpeaking ? (
        <WavesIcon className="size-4" />
      ) : (
        <MicOff className="size-4" />
      )}
    </ComposerIconButton>
  );
}
