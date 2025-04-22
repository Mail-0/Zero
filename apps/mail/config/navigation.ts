import { MessageSquareIcon } from '@/components/icons/animated/message-square';
import { SettingsGearIcon } from '@/components/icons/animated/settings-gear';
import { CheckCheckIcon } from '@/components/icons/animated/check-check';
import { ArrowLeftIcon } from '@/components/icons/animated/arrow-left';
import { BookTextIcon } from '@/components/icons/animated/book-text';
import { ShieldCheckIcon } from '@/components/icons/animated/shield';
import { KeyboardIcon } from '@/components/icons/animated/keyboard';
import { SparklesIcon } from '@/components/icons/animated/sparkles';
import { ArchiveIcon } from '@/components/icons/animated/archive';
import { DeleteIcon } from '@/components/icons/animated/trash';
import { UsersIcon } from '@/components/icons/animated/users';
import { InboxIcon } from '@/components/icons/animated/inbox';
import { XIcon } from '@/components/icons/animated/x';
import { NestedKeyOf } from 'next-intl';
import { MessageKeys } from 'next-intl';
export interface NavItem {
  id?: string;
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: number;
  isBackButton?: boolean;
  isSettingsButton?: boolean;
  disabled?: boolean;
  target?: string;
}
export type MessageKey = MessageKeys<IntlMessages, NestedKeyOf<IntlMessages>>;

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavConfig {
  path: string;
  sections: NavSection[];
}

// ! items title has to be a message key (check messages/en.json)
export const navigationConfig: Record<string, NavConfig> = {
  mail: {
    path: '/mail',
    sections: [
      {
        title: '',
        items: [
          {
            id: 'inbox',
            title: 'navigation.sidebar.inbox',
            url: '/mail/inbox',
            icon: InboxIcon,
          },
          {
            id: 'drafts',
            title: 'navigation.sidebar.drafts',
            url: '/mail/draft',
            icon: BookTextIcon,
          },
          {
            id: 'sent',
            title: 'navigation.sidebar.sent',
            url: '/mail/sent',
            icon: CheckCheckIcon,
          },
          {
            id: 'spam',
            title: 'navigation.sidebar.spam',
            url: '/mail/spam',
            icon: XIcon,
          },
          {
            id: 'archive',
            title: 'navigation.sidebar.archive',
            url: '/mail/archive',
            icon: ArchiveIcon,
          },
          {
            id: 'bin',
            title: 'navigation.sidebar.bin',
            url: '/mail/bin',
            icon: DeleteIcon,
            disabled: false,
          },
          // {
          //   id: 'settings',
          //   title: 'navigation.sidebar.settings',
          //   url: '/settings/general',
          //   icon: SettingsGearIcon,
          //   isSettingsButton: true,
          // },
          {
            id: 'feedback',
            title: 'navigation.sidebar.feedback',
            url: 'https://feedback.0.email',
            icon: MessageSquareIcon,
            target: '_blank',
          },
        ],
      },
      // {
      //   title: "Categories",
      //   items: [
      //     {
      //       title: "Social",
      //       url: "/mail/inbox?category=social",
      //       icon: UsersIcon,
      //       badge: 972,
      //     },
      //     {
      //       title: "Updates",
      //       url: "/mail/inbox?category=updates",
      //       icon: BellIcon,
      //       badge: 342,
      //     },
      //     {
      //       title: "Forums",
      //       url: "/mail/inbox?category=forums",
      //       icon: MessageCircleIcon,
      //       badge: 128,
      //     },
      //     {
      //       title: "Shopping",
      //       url: "/mail/inbox?category=shopping",
      //       icon: CartIcon,
      //       badge: 8,
      //     },
      //   ],
      // },
    ],
  },
  settings: {
    path: '/settings',
    sections: [
      {
        title: 'Settings',
        items: [
          {
            title: 'common.actions.back',
            url: '/mail',
            icon: ArrowLeftIcon,
            isBackButton: true,
          },

          {
            title: 'navigation.settings.general',
            url: '/settings/general',
            icon: SettingsGearIcon,
          },
          {
            title: 'navigation.settings.connections',
            url: '/settings/connections',
            icon: UsersIcon,
          },
          {
            title: 'navigation.settings.security',
            url: '/settings/security',
            icon: ShieldCheckIcon,
            disabled: true,
          },
          {
            title: 'navigation.settings.appearance',
            url: '/settings/appearance',
            icon: SparklesIcon,
          },
          {
            title: 'navigation.settings.labels',
            url: '/settings/labels',
            icon: SparklesIcon,
          },
          {
            title: 'navigation.settings.signatures',
            url: '/settings/signatures',
            icon: MessageSquareIcon,
            disabled: true,
          },
          {
            title: 'navigation.settings.shortcuts',
            url: '/settings/shortcuts',
            icon: KeyboardIcon,
            // disabled: true,
          },
          // {
          //   title: "Notifications",
          //   url: "/settings/notifications",
          //   icon: BellIcon,
          // },
        ].map((item) => ({
          ...item,
          isSettingsPage: true,
        })),
      },
    ],
  },
};
