import { useContextData } from '@/hooks/use-context-data';
import {
  Briefcase,
  Handshake,
  DollarSign,
  Workflow,
} from 'lucide-react';
import { formatStageLabel } from '@/lib/utils';

export function ContextHeader({ email }: { email?: string }) {
  const { data, isLoading } = useContextData(email);
  if (!email || isLoading || !data?.contact) return null;

  const account = data.contact.companyName;
  const deal = data.deals?.[0];

  const tags = [
    account && {
      label: 'Account',
      value: account,
      icon: Briefcase,
    },
    deal?.name && {
      label: 'Opportunity',
      value: deal.name,
      icon: Handshake,
    },
    deal?.amount && {
      value: Number(deal.amount).toLocaleString(),
      icon: DollarSign,
    },
    deal?.stage && {
      label: 'Stage',
      value: formatStageLabel(deal.stage),
      icon: Workflow,
    },
  ].filter(Boolean) as {
    label: string;
    value: string;
    icon: React.ElementType;
  }[];

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="flex flex-wrap items-center gap-3">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1 text-sm shadow-sm ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700"
          >
            <tag.icon className="h-3.5 w-3.5 opacity-70 relative top-[0.5px]" />
            <span className="font-semibold">{tag.label}:</span>{' '}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">{tag.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
