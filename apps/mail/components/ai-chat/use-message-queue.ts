import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export const MAX_QUEUED_MESSAGES = 5;

export type QueuedMessage<TPayload, TComposerState> = {
  id: string;
  payload: TPayload;
  preview: string;
  attachmentCount: number;
  /** What to put back in the composer when the user edits it. */
  composerState: TComposerState;
  restoreIndex?: number;
};

/**
 * Messages sent while the assistant is still answering wait here and go out
 * one by one as each turn finishes. Stop pauses the queue; "send now" stops the
 * current turn and sends that message next. Ported from Orchid.
 */
export function useMessageQueue<TPayload, TComposerState>({
  isProcessing,
  send,
  stop,
}: {
  isProcessing: boolean;
  send: (payload: TPayload) => Promise<unknown> | void;
  stop: () => void;
}) {
  const [queue, setQueue] = useState<QueuedMessage<TPayload, TComposerState>[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const queueRef = useRef(queue);
  const pausedRef = useRef(isPaused);
  const processingRef = useRef(isProcessing);
  const wasProcessingRef = useRef(isProcessing);
  const sendRef = useRef(send);
  const stopRef = useRef(stop);
  const pendingDispatchIdRef = useRef<string | null>(null);
  const startingRef = useRef(false);

  // Sync latest values after commit (not during render) so a discarded concurrent
  // render can't leave stale props behind. Layout effects run before the passive
  // effects below and before any event handler reads these refs.
  useLayoutEffect(() => {
    processingRef.current = isProcessing;
    sendRef.current = send;
    stopRef.current = stop;
  });

  const updateQueue = useCallback(
    (
      updater: (
        current: QueuedMessage<TPayload, TComposerState>[],
      ) => QueuedMessage<TPayload, TComposerState>[],
    ) => {
      const next = updater(queueRef.current);
      queueRef.current = next;
      setQueue(next);
    },
    [],
  );

  const setPaused = useCallback((paused: boolean) => {
    pausedRef.current = paused;
    setIsPaused(paused);
  }, []);

  const start = useCallback((message: QueuedMessage<TPayload, TComposerState>) => {
    startingRef.current = true;
    void Promise.resolve(sendRef.current(message.payload)).finally(() => {
      startingRef.current = false;
    });
  }, []);

  const dispatchById = useCallback(
    (id: string) => {
      const message = queueRef.current.find((m) => m.id === id);
      if (!message) return;
      updateQueue((current) => current.filter((m) => m.id !== id));
      start(message);
    },
    [start, updateQueue],
  );

  const isBusy = () => processingRef.current || startingRef.current;

  // A "send now" waits for the stopped turn to wind down, then goes first.
  useEffect(() => {
    const wasProcessing = wasProcessingRef.current;
    wasProcessingRef.current = isProcessing;
    if (isProcessing || !wasProcessing || !pendingDispatchIdRef.current) return;
    const id = pendingDispatchIdRef.current;
    pendingDispatchIdRef.current = null;
    const timeout = setTimeout(() => !isBusy() && dispatchById(id), 100);
    return () => clearTimeout(timeout);
  }, [isProcessing, dispatchById]);

  useEffect(() => {
    if (isProcessing || isPaused || queue.length === 0) return;
    const timeout = setTimeout(() => {
      if (isBusy() || pausedRef.current || pendingDispatchIdRef.current) return;
      const next = queueRef.current[0];
      if (next) dispatchById(next.id);
    }, 150);
    return () => clearTimeout(timeout);
  }, [isProcessing, isPaused, queue.length, dispatchById]);

  const enqueue = useCallback(
    (message: QueuedMessage<TPayload, TComposerState>) => {
      if (isBusy() || queueRef.current.length > 0) {
        if (queueRef.current.length >= MAX_QUEUED_MESSAGES) return false;
        // Submitting while idle means "carry on": resume a queue paused by Stop.
        if (!isBusy()) setPaused(false);
        updateQueue((current) => {
          const next = [...current];
          const index = message.restoreIndex ?? next.length;
          next.splice(Math.max(0, Math.min(index, next.length)), 0, message);
          return next;
        });
        return true;
      }
      setPaused(false);
      start(message);
      return true;
    },
    [setPaused, start, updateQueue],
  );

  const remove = useCallback(
    (id: string) => {
      if (pendingDispatchIdRef.current === id) pendingDispatchIdRef.current = null;
      updateQueue((current) => current.filter((m) => m.id !== id));
    },
    [updateQueue],
  );

  const takeForEdit = useCallback(
    (id: string) => {
      const index = queueRef.current.findIndex((m) => m.id === id);
      const message = queueRef.current[index];
      if (!message) return null;
      remove(id);
      return { message, index };
    },
    [remove],
  );

  const sendNow = useCallback(
    (id: string) => {
      if (!queueRef.current.some((m) => m.id === id)) return;
      setPaused(false);
      if (isBusy()) {
        pendingDispatchIdRef.current = id;
        stopRef.current();
        return;
      }
      dispatchById(id);
    },
    [dispatchById, setPaused],
  );

  const pause = useCallback(() => setPaused(true), [setPaused]);
  const clear = useCallback(() => {
    pendingDispatchIdRef.current = null;
    setPaused(false);
    updateQueue(() => []);
  }, [setPaused, updateQueue]);

  return {
    queue,
    isPaused,
    isFull: queue.length >= MAX_QUEUED_MESSAGES,
    enqueue,
    remove,
    takeForEdit,
    sendNow,
    pause,
    resume: () => setPaused(false),
    clear,
  };
}
