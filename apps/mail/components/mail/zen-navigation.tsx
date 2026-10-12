import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Archive2, Eye, Star2, Trash } from '@/components/icons/icons';
import { useOptimisticActions } from '@/hooks/use-optimistic-actions';
import { navigationConfig } from '@/config/navigation';
import { useNavigate, useParams } from 'react-router';
import { ChevronDown, SquarePen } from 'lucide-react';
import { useMail } from '@/components/mail/use-mail';
import { NavUser } from '@/components/ui/nav-user';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { useQueryState } from 'nuqs';

export function ZenNavigation() {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <NavUser compact />
    </div>
  );
}

export function ZenBulkActions() {
  const [mail, setMail] = useMail();
  const { folder = 'inbox' } = useParams<{ folder: string }>();
  const {
    optimisticMarkAsRead,
    optimisticToggleStar,
    optimisticMoveThreadsTo,
    optimisticDeleteThreads,
  } = useOptimisticActions();
  const actions = [
    {
      label: m['common.mail.markAsRead'](),
      icon: Eye,
      run: () => optimisticMarkAsRead(mail.bulkSelected),
    },
    {
      label: m['common.mail.starAll'](),
      icon: Star2,
      run: () => optimisticToggleStar(mail.bulkSelected, true),
    },
    {
      label: m['common.mail.archive'](),
      icon: Archive2,
      run: () => optimisticMoveThreadsTo(mail.bulkSelected, folder, 'archive'),
    },
    {
      label: m['common.mail.moveToBin'](),
      icon: Trash,
      run: () => optimisticDeleteThreads(mail.bulkSelected, folder),
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground mr-2 text-sm">
        {mail.bulkSelected.length} selected
      </span>
      {actions.map((action) => (
        <Tooltip key={action.label}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="bg-muted h-7 w-7 rounded-lg"
              aria-label={action.label}
              onClick={() => {
                action.run();
                setMail((previous) => ({ ...previous, bulkSelected: [] }));
              }}
            >
              <action.icon className="fill-muted-foreground h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{action.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function ZenFolderSelect() {
  const { folder = 'inbox' } = useParams<{ folder: string }>();
  const navigate = useNavigate();
  const items = navigationConfig.mail.sections.flatMap((section) => section.items);
  const currentFolder = items.find((item) => item.url === `/mail/${folder}`);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-7 gap-1.5 px-2 text-sm">
          {currentFolder?.icon && <currentFolder.icon className="fill-muted-foreground h-4 w-4" />}
          <span>{currentFolder?.title ?? folder}</span>
          <ChevronDown className="text-muted-foreground h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {items.map((item) => (
          <DropdownMenuItem key={item.url} onClick={() => navigate(item.url)}>
            <item.icon className="fill-muted-foreground h-4 w-4" />
            {item.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ZenComposeButton() {
  const [, setIsComposeOpen] = useQueryState('isComposeOpen');
  const [, setDraftId] = useQueryState('draftId');
  const [, setTo] = useQueryState('to');
  const [, setMode] = useQueryState('mode');
  const [, setActiveReplyId] = useQueryState('activeReplyId');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="h-7 w-7 rounded-md px-0"
          aria-label={m['common.commandPalette.commands.newEmail']()}
          onClick={() => {
            setDraftId(null);
            setTo(null);
            setMode(null);
            setActiveReplyId(null);
            setIsComposeOpen('true');
          }}
        >
          <SquarePen className="text-muted-foreground h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{m['common.commandPalette.commands.newEmail']()}</TooltipContent>
    </Tooltip>
  );
}
