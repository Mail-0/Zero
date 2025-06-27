import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechToTextOptions {
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

interface UseSpeechToTextReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechToText({
  onTranscript,
  onError,
  continuous = false,
  interimResults = true,
  lang = 'en-US',
}: UseSpeechToTextOptions = {}): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isSupported = useRef(false);

  // Check for browser support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      isSupported.current = !!SpeechRecognition;
      
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
      }
    }
  }, []);

  // Configure speech recognition
  useEffect(() => {
    if (!recognitionRef.current) return;

    const recognition = recognitionRef.current;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('Speech recognition result received:', event);
      let finalTranscript = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimText += transcript;
        }
      }

      console.log('Processed transcripts:', { finalTranscript, interimText });

      if (finalTranscript) {
        setTranscript((prev) => prev + finalTranscript);
        onTranscript?.(finalTranscript);
      }

      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: Event) => {
      const errorMessage = (event as any).error || 'Speech recognition error';
      setError(errorMessage);
      setIsListening(false);
      onError?.(errorMessage);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    return () => {
      recognition.onstart = () => {};
      recognition.onresult = () => {};
      recognition.onerror = () => {};
      recognition.onend = () => {};
    };
  }, [continuous, interimResults, lang, onTranscript, onError]);

  const startListening = useCallback(() => {
    console.log('startListening called:', {
      hasRecognition: !!recognitionRef.current,
      isSupported: isSupported.current,
      isListening,
      SpeechRecognition: typeof window !== 'undefined' ? !!(window.SpeechRecognition || window.webkitSpeechRecognition) : false
    });

    if (!recognitionRef.current || !isSupported.current) {
      const errorMsg = 'Speech recognition not supported in this browser';
      console.error(errorMsg);
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    if (isListening) {
      console.log('Already listening, skipping...');
      return;
    }

    try {
      console.log('Starting speech recognition...');
      setError(null);
      setInterimTranscript('');
      recognitionRef.current.start();
    } catch (err) {
      const errorMsg = 'Failed to start speech recognition';
      console.error('Speech recognition start error:', err);
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [isListening, onError]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;

    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return {
    isListening,
    isSupported: isSupported.current,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
} 