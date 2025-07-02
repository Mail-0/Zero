import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { m } from '@/paraglide/messages';

interface HotkeyRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onHotkeyRecorded: (keys: string[]) => void;
  currentKeys: string[];
}

export function HotkeyRecorder({
  isOpen,
  onClose,
  onHotkeyRecorded,
  currentKeys,
}: HotkeyRecorderProps) {
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      if (!isRecording) return;

      const key = e.key === ' ' ? 'Space' : e.key;

      const formattedKey = key.length === 1 ? key.toUpperCase() : key;

      if (!recordedKeys.includes(formattedKey)) {
        setRecordedKeys((prev) => [...prev, formattedKey]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      if (isRecording) {
        setIsRecording(false);
        if (recordedKeys.length > 0) {
          onHotkeyRecorded(recordedKeys);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, isRecording, recordedKeys, onHotkeyRecorded, onClose]);

  useEffect(() => {
    if (isOpen) {
      setRecordedKeys([]);
      setIsRecording(true);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m['pages.settings.shortcuts.actions.recordHotkey']()}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="text-muted-foreground text-center text-sm">
            {isRecording
              ? m['pages.settings.shortcuts.actions.pressKeys']()
              : m['pages.settings.shortcuts.actions.releaseKeys']()}
          </div>
          <div className="flex gap-2">
            {(recordedKeys.length > 0 ? recordedKeys : currentKeys).map((key) => (
              <kbd
                key={key}
                className="border-muted-foreground/10 bg-accent h-6 rounded-[6px] border px-1.5 font-mono text-xs leading-6"
              >
                {key}
              </kbd>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
