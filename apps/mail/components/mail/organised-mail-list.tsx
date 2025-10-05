import { fakeOrganisedEmails, type FakeEmail } from '@/lib/fake-organised-data';
import { ChevronDown, ChevronRight, FileCheck } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';

interface OrganisedMailListProps {
  onEmailSelect: (email: FakeEmail) => void;
  selectedEmailId: string | null;
}

const categoryColors = {
  'Deal Responses': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  'Deal Followups': 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  Important: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  General: 'bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20',
};

const categoryDescriptions = {
  'Deal Responses': 'Pre-drafted responses to X emails',
  'Deal Followups': 'Follow ups drafted based on deals',
} as const;

const CategorySection = memo(
  ({
    category,
    emails,
    onEmailSelect,
    selectedEmailId,
    isExpanded,
    onToggle,
  }: {
    category: string;
    emails: FakeEmail[];
    onEmailSelect: (email: FakeEmail) => void;
    selectedEmailId: string | null;
    isExpanded: boolean;
    onToggle: () => void;
  }) => {
    const unreadCount = emails.filter((e) => e.unread).length;

    return (
      <div className="mb-4">
        <button
          onClick={onToggle}
          className="hover:bg-accent/50 mb-2 flex w-full items-center justify-between rounded-lg px-4 py-2 transition-colors"
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronRight className="text-muted-foreground h-4 w-4" />
            )}
            <h3 className="text-foreground text-sm font-semibold">{category}</h3>
            <Badge variant="secondary" className="text-xs">
              {emails.length}
            </Badge>
            {unreadCount > 0 && (
              <Badge
                className={cn('text-xs', categoryColors[category as keyof typeof categoryColors])}
              >
                {unreadCount} new
              </Badge>
            )}
            {categoryDescriptions[category as keyof typeof categoryDescriptions] && (
              <span className="text-muted-foreground text-xs">
                {categoryDescriptions[category as keyof typeof categoryDescriptions]}
              </span>
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="space-y-0">
            {emails.map((email, index) => (
              <FakeEmailItem
                key={email.id}
                email={email}
                index={index}
                onClick={() => {
                  console.log('Email clicked:', email);
                  onEmailSelect(email);
                }}
                isSelected={selectedEmailId === email.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

CategorySection.displayName = 'CategorySection';

// Simplified email item that mimics the Thread component's new compact Gmail-like style
const FakeEmailItem = memo(
  ({
    email,
    onClick,
    isSelected,
  }: {
    email: FakeEmail;
    index: number;
    onClick: () => void;
    isSelected: boolean;
  }) => {
    const cleanName = email.sender.name.trim().replace(/^['"]|['"]$/g, '');

    return (
      <div
        onClick={onClick}
        className={cn(
          'hover:bg-offsetLight dark:hover:bg-primary/5 group relative mx-1 flex cursor-pointer items-center rounded-lg border-b py-1.5 text-left text-sm transition-all hover:opacity-100 md:my-1 md:border-none',
          isSelected && 'border-border bg-primary/5 opacity-100',
        )}
      >
        <div
          className={`relative flex w-full items-center gap-4 px-4 ${email.unread && !isSelected ? '' : 'opacity-60'}`}
        >
          {/* Profile pic */}
          <div className="flex shrink-0 items-center">
            <div className="bg-primary/10 flex h-6 w-6 items-center justify-center rounded-full">
              <span className="text-primary text-xs font-medium">
                {cleanName.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Single line content - Gmail style */}
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {/* Sender name */}
              <span
                className={cn(
                  email.unread && !isSelected ? 'font-semibold' : 'font-normal',
                  'text-foreground flex shrink-0 items-center gap-1 text-sm',
                )}
              >
                <span className="max-w-[12ch] truncate md:max-w-[20ch]">{cleanName}</span>
                {email.unread && !isSelected && (
                  <span className="ml-0.5 size-2 shrink-0 rounded-full bg-[#006FFE]" />
                )}
              </span>

              {/* Subject */}
              {email.subject && (
                <>
                  <span className="text-muted-foreground shrink-0 text-sm">-</span>
                  <span
                    className={cn(
                      email.unread && !isSelected ? 'font-medium' : 'font-normal',
                      'text-foreground truncate text-sm',
                    )}
                  >
                    {email.subject}
                  </span>
                </>
              )}

              {/* Body preview */}
              {email.body && (
                <>
                  <span className="text-muted-foreground shrink-0 text-sm">-</span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                    {email.body}
                  </span>
                </>
              )}
            </div>

            {/* Draft Ready Badge */}
            <Badge
              variant="secondary"
              className="mr-2 shrink-0 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
            >
              <FileCheck className="mr-1 h-3 w-3" />
              Draft ready for review
            </Badge>

            {/* Date */}
            <p
              className={cn(
                'text-muted-foreground shrink-0 text-nowrap text-xs font-normal opacity-70 transition-opacity group-hover:opacity-100 dark:text-[#8C8C8C]',
                isSelected && 'opacity-100',
              )}
            >
              {formatDate(email.receivedOn.split('.')[0] || '')}
            </p>
          </div>
        </div>
      </div>
    );
  },
);

FakeEmailItem.displayName = 'FakeEmailItem';

export const OrganisedMailList = memo(function OrganisedMailList({
  onEmailSelect,
  selectedEmailId,
}: OrganisedMailListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Deal Responses', 'Deal Followups', 'Important', 'General']),
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const categorizedEmails = useMemo(() => {
    const categories = {
      'Deal Responses': [] as FakeEmail[],
      'Deal Followups': [] as FakeEmail[],
      Important: [] as FakeEmail[],
      General: [] as FakeEmail[],
    };

    fakeOrganisedEmails.forEach((email) => {
      categories[email.category].push(email);
    });

    return categories;
  }, []);

  return (
    <div className="scrollbar-none h-full w-full overflow-y-auto">
      {Object.entries(categorizedEmails).map(([category, emails]) => (
        <CategorySection
          key={category}
          category={category}
          emails={emails}
          onEmailSelect={onEmailSelect}
          selectedEmailId={selectedEmailId}
          isExpanded={expandedCategories.has(category)}
          onToggle={() => toggleCategory(category)}
        />
      ))}
    </div>
  );
});
