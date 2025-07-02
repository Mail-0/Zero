import React from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { Paperclip } from 'lucide-react';
import { Droppable } from '@/components/ui/droppable';

interface FileDropZoneProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  onFilesDropped: (files: File[]) => void;
}

export function FileDropZone({ 
  id = "file-drop-zone", 
  children, 
  className, 
  onFilesDropped 
}: FileDropZoneProps) {
  const [isOverDropZone, setIsOverDropZone] = React.useState(false);

  // This handles external files being dragged over the drop zone
  const handleDragEnd = (event: DragEndEvent) => {
    setIsOverDropZone(false);
  };

  // Since we're handling file drops from outside the app, 
  // we need to track when the drag starts entering the drop zone
  const handleDragStart = (event: any) => {
    if (event.active.data?.current?.files) {
      setIsOverDropZone(true);
    }
  };

  return (
    <DndContext 
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
    >
      <Droppable
        id={id}
        className={className}
        onFilesDropped={onFilesDropped}
      >
        <div className="relative w-full h-full">
          {children}
          
          {/* Overlay that appears when files are being dragged over */}
          {isOverDropZone && (
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-primary/10 pointer-events-none">
              <div className="flex flex-col items-center justify-center gap-2 text-primary">
                <Paperclip className="h-8 w-8" />
                <p className="text-sm font-medium">Drop files to attach</p>
              </div>
            </div>
          )}
        </div>
      </Droppable>

      <DragOverlay>
        {isOverDropZone && (
          <div className="p-2 bg-background border rounded-md shadow-md opacity-80">
            <Paperclip className="h-4 w-4" />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
} 