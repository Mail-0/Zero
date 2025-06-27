import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { VisuallyHidden } from 'radix-ui';
import { type ReactElement } from 'react';
// import { useMedia } from 'react-use';

type ResponsiveModalProps = {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ResponsiveModal({
  children,
  open,
  onOpenChange,
}: ResponsiveModalProps): ReactElement {
  const isDesktop = true;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <VisuallyHidden.VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Modal content</DialogDescription>
          </DialogHeader>
        </VisuallyHidden.VisuallyHidden>
        <DialogContent className="w-full overflow-y-auto border-none p-0 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-lg [&::-webkit-scrollbar]:hidden">
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <VisuallyHidden.VisuallyHidden>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
          </DrawerHeader>
        </VisuallyHidden.VisuallyHidden>
        <div className="overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
