import { Mic, MicOff, Loader2, WavesIcon } from 'lucide-react';
import { useVoice } from '@/providers/voice-provider';
import { motion } from 'motion/react';

import { useSession } from '@/lib/auth-client';
import { useQueryState } from 'nuqs';

export function VoiceButton() {
  const { data: session } = useSession();
  const [threadId] = useQueryState('threadId');

  const { status, isInitializing, isSpeaking, startConversation, endConversation } = useVoice();

  const isConnected = status === 'connected';

  const handleStartConversation = async () => {
    const context = {
      hasOpenEmail: !!threadId,
      currentThreadId: threadId || null,
    };

    await startConversation(context);
  };

  if (!session) {
    return null;
  }

  if (!isConnected) {
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
        <button type="button" onClick={handleStartConversation}>
          <div className="dark:bg[#141414] flex h-7 items-center justify-center rounded-sm bg-[#262626] px-2">
            <Mic className="h-4 w-4 text-white dark:text-[#929292]" />
          </div>
        </button>
      </motion.div>
    );
  }

  return (
    isConnected && (
      <button type="button" onClick={endConversation}>
        <div className="dark:bg[#141414] flex h-7 items-center justify-center rounded-sm bg-[#262626] px-2">
          {isInitializing && (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!isInitializing &&
            (isSpeaking ? (
              <WavesIcon className="h-4 w-4 text-white dark:text-[#929292]" />
            ) : (
              <MicOff className="h-4 w-4 text-white dark:text-[#929292]" />
            ))}
        </div>
      </button>
    )
  );
}
