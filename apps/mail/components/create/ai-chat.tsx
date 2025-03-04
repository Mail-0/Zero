"use client";

import {
  ImageIcon,
  FileUp,
  Figma,
  MonitorIcon,
  CircleUserRound,
  ArrowUpIcon,
  Paperclip,
  PlusIcon,
  Mic,
} from "lucide-react";
import { useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { AITextarea } from "./ai-textarea";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      // Temporarily shrink to get the right scrollHeight
      textarea.style.height = `${minHeight}px`;

      // Calculate new height
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    // Set initial height
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  // Adjust height on window resize
  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

export function AIChat() {
  const [value, setValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(Array(30).fill(0));
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const updateAudioData = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Convert the audio data to wave heights (values between 0 and 1)
    // Using frequency data for better visualization
    const normalizedData = Array.from(dataArray)
      .slice(0, 30)
      .map((value) => value / 255);

    setAudioData(normalizedData);
    animationFrameRef.current = requestAnimationFrame(updateAudioData);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        setValue("");
        adjustHeight(true);
      }
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle file upload here
      console.log("Selected files:", files);
      // You can implement file upload logic here
    }
  };

  const handleMicClick = async () => {
    try {
      if (!isRecording) {
        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        // Set up audio context for visualization
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;

        // Start visualization
        updateAudioData();
        setIsRecording(true);
        setIsListening(true);

        // Set up speech recognition
        if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognitionRef.current = new SpeechRecognition();
          recognitionRef.current.continuous = true;
          recognitionRef.current.interimResults = true;

          recognitionRef.current.onresult = (event) => {
            const transcript = Array.from(event.results)
              .map((result) => result[0]?.transcript || "")
              .join("");

            setValue((prev) => {
              // Only update if we have new content
              if (transcript && transcript !== prev) {
                return transcript;
              }
              return prev;
            });

            // Adjust textarea height when text changes
            adjustHeight();
          };

          recognitionRef.current.onend = () => {
            // Restart if we're still recording
            if (isRecording && recognitionRef.current) {
              recognitionRef.current.start();
            }
          };

          recognitionRef.current.start();
        } else {
          toast.error("Your browser does not support speech recognition.");
        }
      } else {
        // Stop recording
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }

        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }

        if (recognitionRef.current) {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        }

        setIsRecording(false);
        setIsListening(false);
        setAudioData(Array(30).fill(0));
      }
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  useEffect(() => {
    return () => {
      // Clean up resources when component unmounts
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center space-y-8 py-1">
      <div className="w-full">
        <div className="relative rounded-xl border dark:border-neutral-800 dark:bg-neutral-900">
          <div className="overflow-y-auto px-2">
            {isRecording ? (
              <div className="flex h-[64px] min-h-[60px] w-full flex-col items-center justify-center px-4">
                <div className="mt-4 flex items-center justify-center gap-1">
                  {audioData.map((height, index) => (
                    <div
                      key={index}
                      className="bg-muted-foreground w-1.5 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, height * 40)}px`,
                        transform: `scaleY(${Math.max(0.1, height)})`,
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <AITextarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask Zero a question..."
                className="text-foreground placeholder:text-muted-foreground dark:placeholder:text-muted-foreground min-h-[60px] w-full resize-none border-none bg-transparent px-4 py-3 text-sm placeholder:text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-white"
                style={{
                  overflow: "hidden",
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
              <div className="flex items-center gap-2">
                <Button variant="outline" className="w-9" onClick={handleFileClick}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={cn("w-9", isRecording && "bg-red-500 text-white hover:bg-red-600")}
                  onClick={handleMicClick}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="default" className="w-9" disabled={!value.trim()}>
                <ArrowUpIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
