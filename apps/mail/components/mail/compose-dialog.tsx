import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { m } from '@/paraglide/messages';
import { lazy, Suspense } from 'react';
import { useQueryState } from 'nuqs';

// The composer (tiptap editor + extensions) is large; keep it out of the initial
// inbox bundle and only fetch it when compose is opened (or prefetched on hover).
const loadCreateEmail = () => import('@/components/create/create-email');
const CreateEmail = lazy(() => loadCreateEmail().then((mod) => ({ default: mod.CreateEmail })));

let composerPrefetch: Promise<unknown> | null = null;
export function prefetchComposer() {
  composerPrefetch ??= loadCreateEmail().catch(() => {
    composerPrefetch = null;
  });
}

export function ComposeDialog() {
  const [dialogOpen, setDialogOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const [, setTo] = useQueryState('to');
  const [, setActiveReplyId] = useQueryState('activeReplyId');
  const [, setMode] = useQueryState('mode');

  return (
    <Dialog
      open={!!dialogOpen}
      onOpenChange={(open) => {
        setDialogOpen(open ? 'true' : null);
        setDraftId(null);
        setTo(null);
        setActiveReplyId(null);
        setMode(null);
      }}
    >
      <DialogContent className="h-screen w-screen max-w-none border-none bg-[#FAFAFA] p-0 shadow-none dark:bg-[#141414]">
        <DialogTitle className="sr-only">
          {m['common.commandPalette.commands.newEmail']()}
        </DialogTitle>
        <DialogDescription className="sr-only">Compose a new email</DialogDescription>
        {dialogOpen ? (
          <Suspense fallback={null}>
            <CreateEmail />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
