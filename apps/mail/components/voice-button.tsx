'use client';

import { Mic, MicOff, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatePresence, motion } from 'motion/react';
import { useVoice } from '@/providers/voice-provider';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export function VoiceButton() {
  const { data: session } = useSession();
  const {
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
    setOpen,
  } = useVoice();

  const isConnected = status === 'connected';

  if (!session) {
    return null;
  }

  if (!isOpen && !isConnected) {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="fixed bottom-6 right-20 z-50"
      >
        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => startConversation()}
        >
          <Mic className="h-6 w-6" />
        </Button>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {(isOpen || isConnected) && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Card className="w-80 shadow-xl">
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Zero AI Assistant</h3>
                {!isConnected && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="mb-4 space-y-3">
                <div className="bg-muted rounded-lg p-3 text-center text-sm">
                  {status === 'disconnected' && !isInitializing && (
                    <p className="text-muted-foreground">Ready to start</p>
                  )}
                  {isInitializing && (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-muted-foreground">Initializing...</p>
                    </div>
                  )}
                  {isConnected && (
                    <div className="space-y-1">
                      <p
                        className={cn(
                          'font-medium',
                          isSpeaking ? 'text-green-600' : 'text-blue-600',
                        )}
                      >
                        {isSpeaking ? 'Assistant is speaking...' : 'Listening...'}
                      </p>
                      {lastToolCall && (
                        <p className="text-muted-foreground text-xs">{lastToolCall}</p>
                      )}
                    </div>
                  )}
                  {errorMessage && <p className="text-destructive text-xs">{errorMessage}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={endConversation}
                      className="flex-1"
                    >
                      <MicOff className="mr-2 h-4 w-4" />
                      End
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={toggleMute}
                      className="h-9 w-9"
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => startConversation()} className="w-full">
                    {isInitializing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mic className="mr-2 h-4 w-4" />
                    )}
                    Start Conversation
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
