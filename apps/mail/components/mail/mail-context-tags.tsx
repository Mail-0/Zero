import { Briefcase } from 'lucide-react';

export function MailContextTags({ tags }: { tags: string[] }) {
  if (!tags || tags.length < 2) return null;

  const tagText = `${tags[0]}: ${tags[1]}`; // Account: Opportunity

  return (
    <div className="mt-3">
      <span
        className="inline-flex max-w-[220px] items-center gap-1.5 truncate rounded-md bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-800 shadow-sm ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
        title={tagText}
      >
        <Briefcase className="h-3.5 w-3.5 opacity-70" />
        {tagText}
      </span>
    </div>
  );
}
