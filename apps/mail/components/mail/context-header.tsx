import { useContextTags } from '@/hooks/use-context-tags.ts';

export function ContextHeader({ email }: { email?: string }) {
  const { tags, isLoading } = useContextTags(email);

  if (!email || isLoading || !tags.length) return null;

  return (
    <div className="mb-4 px-4">
      <div className="rounded-xl border border-border bg-muted/30 p-4 shadow-sm">
        <div className="mb-1 text-xs text-muted-foreground font-medium">Customer Context</div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span
              key={i}
              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                i === 0
                  ? 'bg-blue-100 text-blue-700'   // Account
                  : 'bg-green-100 text-green-700' // Deal(s)
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
