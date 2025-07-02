import { Skeleton } from '../ui/skeleton';

export const ThreadSkeleton = () => (
  <div className="select-none border-b px-1 py-1 md:my-1 md:border-none">
    <div className="flex items-center space-x-4 px-4 py-2">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <Skeleton className="h-4 w-4/5 rounded" />
        <div className="pt-1">
          <Skeleton className="h-3 w-full rounded" />
        </div>
      </div>
    </div>
  </div>
);
