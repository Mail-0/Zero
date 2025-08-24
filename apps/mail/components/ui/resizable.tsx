import * as ResizablePrimitive from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
  <ResizablePrimitive.PanelGroup
    className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
    {...props}
  />
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) => (
  <ResizablePrimitive.PanelResizeHandle
    className={cn(
      // Invisible handle but still draggable; provide a small hit area
      'relative flex w-2 items-center justify-center opacity-0 data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full focus-visible:outline-none focus-visible:ring-0',
      className,
    )}
    {...props}
  >
    {/* Intentionally render nothing to keep it invisible */}
  </ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
