import React, { useState } from 'react';
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
  const [isOverDropZone, setIsOverDropZone] = useState(false);
  
  // Native DOM event handlers for external file drag and drop
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsOverDropZone(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOverDropZone && e.dataTransfer.types.includes('Files')) {
      setIsOverDropZone(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the drag leaves the component entirely
    // by checking if the related target is not inside the component
    const relatedTarget = e.relatedTarget as Node;
    const currentTarget = e.currentTarget as Node;
    
    if (!currentTarget.contains(relatedTarget)) {
      setIsOverDropZone(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOverDropZone(false);
    
    if (e.dataTransfer.files.length > 0) {
      onFilesDropped(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <>
      <div
        id={id}
        className={className}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
      </div>
    </>
  );
} 