import { useState, useRef, useCallback } from 'react';

interface UseWhisperSpeechOptions {
  onTranscript?: (transcript: string) => void;
  onError?: (error: string) => void;
  apiKey?: string;
}

interface UseWhisperSpeechReturn {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  resetError: () => void;
}

export function useWhisperSpeech({
  onTranscript,
  onError,
}: UseWhisperSpeechOptions = {}): UseWhisperSpeechReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef<string>('');

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      // Use MP4 format for best Whisper compatibility
      // OpenAI Whisper officially supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
      // MP4 has the best browser support and Whisper compatibility
      let selectedMimeType = 'audio/mp4';
      let mediaRecorder: MediaRecorder;
      
      // Try MP4 first (best compatibility)
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        selectedMimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        selectedMimeType = 'audio/mpeg';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        selectedMimeType = 'audio/wav';
      } else {
        // Fallback to WebM (least compatible but widely supported by browsers)
        selectedMimeType = 'audio/webm';
      }
      
      mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      console.log('Using audio format for Whisper:', selectedMimeType);
      mimeTypeRef.current = selectedMimeType;
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);

        try {
          // Create audio blob with the selected MIME type
          const mimeType = mimeTypeRef.current;
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mimeType
          });

          // Determine file extension based on MIME type
          let fileExtension = 'mp4'; // default
          if (mimeType.includes('mp4')) {
            fileExtension = 'mp4';
          } else if (mimeType.includes('mpeg')) {
            fileExtension = 'mp3';
          } else if (mimeType.includes('wav')) {
            fileExtension = 'wav';
          } else if (mimeType.includes('webm')) {
            fileExtension = 'webm';
          }

          console.log('Sending audio to Whisper:', { 
            type: mimeType, 
            extension: fileExtension, 
            size: audioBlob.size 
          });

          // Send to our API endpoint which will forward to OpenAI Whisper
          const formData = new FormData();
          formData.append('audio', audioBlob, `recording.${fileExtension}`);

          const response = await fetch('/api/ai/speech-to-text', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json() as { 
            transcript?: string; 
            error?: string; 
          };
          
          if (result.error) {
            throw new Error(result.error);
          }

          if (result.transcript) {
            onTranscript?.(result.transcript);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to transcribe audio';
          setError(errorMessage);
          onError?.(errorMessage);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsRecording(false);
    }
  }, [onTranscript, onError]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [isRecording]);

  return {
    isRecording,
    isProcessing,
    error,
    startRecording,
    stopRecording,
    resetError,
  };
} 