import { Archive, Copy, Maximize2, Minimize2, X, Reply, MoreVertical } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

export const MailDisplaySkeleton = ({ isFullscreen }: { isFullscreen?: boolean }) => {
  return (
    <>
      <div
        className={cn(
          'relative flex-1 overflow-hidden p-4',
          isFullscreen && 'h-[calc(100dvh-4rem)]',
        )}
      >
        <div className="relative inset-0 h-full overflow-y-auto pb-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
            <Skeleton className="h-[1px] w-full" />
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
              </div>
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Separator />
      <div
        className={cn(
          'relative flex-1 overflow-hidden p-4',
          isFullscreen && 'h-[calc(100dvh-4rem)]',
        )}
      >
        <div className="relative inset-0 h-full overflow-y-auto pb-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
            <Skeleton className="h-[1px] w-full" />
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
              </div>
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <Separator />
      <div
        className={cn(
          'relative flex-1 overflow-hidden p-4',
          isFullscreen && 'h-[calc(100dvh-4rem)]',
        )}
      >
        <div className="relative inset-0 h-full overflow-y-auto pb-0">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </div>
              <Skeleton className="h-6 w-6" />
            </div>
            <Skeleton className="h-[1px] w-full" />
            <div className="space-y-4">
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[95%]" />
              </div>
              <div className="flex flex-col space-y-2">
                <Skeleton className="h-4 w-[88%]" />
                <Skeleton className="h-4 w-[92%]" />
                <Skeleton className="h-4 w-[85%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const MailHeaderSkeleton = ({ isFullscreen }: { isFullscreen?: boolean }) => {
  return (
    <div className="flex items-center border-b p-[7px]">
      <div className="flex flex-1 items-center gap-2">
        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
        <Skeleton className="w-[150px] max-w-[300px] flex-1 truncate text-sm font-medium" />
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          <span className="sr-only">{isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}</span>
        </Button>

        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          <Copy className="h-4 w-4" />
          <span className="sr-only">Copy email data</span>
        </Button>
        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          <Archive className="h-4 w-4" />
          <span className="sr-only">Archive</span>
        </Button>

        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          <Reply className="h-4 w-4" />
          <span className="sr-only">Reply</span>
        </Button>
        <Button variant="ghost" className="md:h-fit md:px-2" disabled={true}>
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More</span>
        </Button>
      </div>
    </div>
  );
};
