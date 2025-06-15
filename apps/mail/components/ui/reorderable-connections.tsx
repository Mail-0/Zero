import React, { useState, useMemo } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReorderConnections } from '@/hooks/use-reorder-connections';

interface Connection {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  orderIndex: number;
}

interface SortableConnectionItemProps {
  connection: Connection;
  onSwitch: (connectionId: string) => void;
  isActive: boolean;
}

function SortableConnectionItem({ connection, onSwitch, isActive }: SortableConnectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: connection.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isActive) {
    // Don't make the active connection draggable/sortable
    return (
      <DropdownMenuItem
        className="flex cursor-pointer items-center gap-3 py-1 opacity-50"
        disabled
      >
        <div className="w-4 h-4" /> {/* Spacer for grip icon */}
        <Avatar className="size-7 rounded-lg">
          <AvatarImage
            className="rounded-lg"
            src={connection.picture || undefined}
            alt={connection.name || connection.email}
          />
          <AvatarFallback className="rounded-lg text-[10px]">
            {(connection.name || connection.email)
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="-space-y-0.5">
          <p className="text-[12px]">{connection.name || connection.email} (Active)</p>
          {connection.name && (
            <p className="text-muted-foreground text-[11px]">
              {connection.email.length > 25
                ? `${connection.email.slice(0, 25)}...`
                : connection.email}
            </p>
          )}
        </div>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex cursor-pointer items-center gap-3 py-1',
        isDragging && 'opacity-50'
      )}
      onClick={() => onSwitch(connection.id)}
      {...attributes}
    >
      <div
        {...listeners}
        className="w-4 h-4 cursor-grab hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <Avatar className="size-7 rounded-lg">
        <AvatarImage
          className="rounded-lg"
          src={connection.picture || undefined}
          alt={connection.name || connection.email}
        />
        <AvatarFallback className="rounded-lg text-[10px]">
          {(connection.name || connection.email)
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div className="-space-y-0.5">
        <p className="text-[12px]">{connection.name || connection.email}</p>
        {connection.name && (
          <p className="text-muted-foreground text-[11px]">
            {connection.email.length > 25
              ? `${connection.email.slice(0, 25)}...`
              : connection.email}
          </p>
        )}
      </div>
    </DropdownMenuItem>
  );
}

interface ReorderableConnectionsProps {
  connections: Connection[];
  activeConnectionId?: string;
  onAccountSwitch: (connectionId: string) => void;
}

export function ReorderableConnections({
  connections,
  activeConnectionId,
  onAccountSwitch,
}: ReorderableConnectionsProps) {
  const { reorderConnections } = useReorderConnections();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  // Sort connections by order, with active connection first
  const sortedConnections = useMemo(() => {
    const sorted = [...connections].sort((a, b) => a.orderIndex - b.orderIndex);
    
    // Move active connection to the top
    if (activeConnectionId) {
      const activeIndex = sorted.findIndex(c => c.id === activeConnectionId);
      if (activeIndex > 0) {
        const activeConnection = sorted.splice(activeIndex, 1)[0];
        sorted.unshift(activeConnection);
      }
    }
    
    return sorted;
  }, [connections, activeConnectionId]);

  // Get non-active connections for dragging
  const draggableConnections = useMemo(() => {
    return sortedConnections.filter(c => c.id !== activeConnectionId);
  }, [sortedConnections, activeConnectionId]);

  const connectionIds = useMemo(() => {
    return draggableConnections.map(c => c.id);
  }, [draggableConnections]);
  const handleDragStart = (event: DragStartEvent) => {
    // Could be used for visual feedback during drag
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = draggableConnections.findIndex((c) => c.id === active.id);
      const newIndex = draggableConnections.findIndex((c) => c.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedDraggableConnections = arrayMove(draggableConnections, oldIndex, newIndex);
        
        // Create the final order with ALL connections (active first, then reordered draggable ones)
        const finalConnectionIds: string[] = [];
        if (activeConnectionId) {
          finalConnectionIds.push(activeConnectionId);
        }
        finalConnectionIds.push(...reorderedDraggableConnections.map(c => c.id));
        
        try {
          await reorderConnections({ connectionIds: finalConnectionIds });
        } catch (error) {
          console.error('Failed to reorder connections:', error);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Show active connection first (non-draggable) */}
      {activeConnectionId && (
        <SortableConnectionItem
          connection={sortedConnections.find(c => c.id === activeConnectionId)!}
          onSwitch={onAccountSwitch}
          isActive={true}
        />
      )}
      
      {/* Show draggable connections */}
      {draggableConnections.length > 0 && (
        <SortableContext
          items={connectionIds}
          strategy={verticalListSortingStrategy}
        >
          {draggableConnections.map((connection) => (
            <SortableConnectionItem
              key={connection.id}
              connection={connection}
              onSwitch={onAccountSwitch}
              isActive={false}
            />
          ))}
        </SortableContext>
      )}
    </DndContext>
  );
}
