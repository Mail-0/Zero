export function DoormanTopBar() {
  return (
    <header className="bg-sidebar border-border flex h-12 shrink-0 items-center border-b px-4">
      <div className="flex items-center gap-2.5">
        <img
          src="/icons-pwa/icon-180.png"
          alt="Doorman"
          width={28}
          height={28}
          className="rounded-md"
        />
        <span className="text-foreground text-lg font-semibold tracking-tight">Doorman</span>
      </div>
    </header>
  );
}
