import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


export function MailContextTags({ tags }: { tags: string[] }) {
    if (!tags?.length) return null;
  
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {tags.map((tag, i) => {
          const isAccount = i === 0; // 1st = companyName
          return (
            <span
              key={i}
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                isAccount
                  ? 'bg-violet-400 text-white'   // Account = blue
                  : 'bg-green-100 text-green-700' // Deal = green
              )}
            >
              {tag}
            </span>
          );
        })}
      </div>
    );
  }
  
