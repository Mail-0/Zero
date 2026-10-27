import { Button } from '@/components/ui/button';

export function MailLoadError({
  unavailable = false,
  onRetry,
}: {
  unavailable?: boolean;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex min-h-16 items-center justify-center gap-3 px-4 py-2">
      <p className="text-muted-foreground text-sm">
        {unavailable ? 'This email is not available yet.' : 'Could not load email.'}
      </p>
      <Button variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
