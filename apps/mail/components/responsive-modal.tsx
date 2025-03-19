import { Dialog, DialogContent, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { DialogTitle } from "@radix-ui/react-dialog";
import { type ReactElement } from "react";
import { useMedia } from "react-use";

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
  const isDesktop = useMedia("(min-width: 1024px)", true);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Modal content</DialogDescription>
          </DialogHeader>
        </VisuallyHidden>
        <DialogContent className="bordr-none w-full overflow-y-auto p-0 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-lg [&::-webkit-scrollbar]:hidden">
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <VisuallyHidden>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
          </DrawerHeader>
        </VisuallyHidden>
        <div className="overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
