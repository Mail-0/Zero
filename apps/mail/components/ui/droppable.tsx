import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

interface DroppableProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  onFilesDropped?: (files: File[]) => void;
}

export function Droppable({ id, children, className, onFilesDropped }: DroppableProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onFilesDropped && e.dataTransfer.files.length > 0) {
      onFilesDropped(Array.from(e.dataTransfer.files));
    }
  };

  // Prevent default drag behaviors
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      ref={setNodeRef} 
      className={cn(className, isOver ? 'ring-2 ring-primary/50 bg-primary/5 rounded-md' : '')}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  );
} 