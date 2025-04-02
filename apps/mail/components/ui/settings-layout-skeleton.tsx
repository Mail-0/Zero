export function SettingsLayoutSkeleton() {
  return (
    <>
      <div className="hidden lg:flex lg:w-80" />
      <div className="bg-sidebar w-full md:p-3">
        <div className="bg-muted h-[calc(100svh-1.5rem)] animate-pulse md:rounded-2xl" />
      </div>
    </>
  );
} 