import {
  Archive,
  Bin,
  ExclamationCircle,
  Folder,
  Inbox,
  MessageSquare,
  NotesList,
  PaperPlane,
  SettingsGear,
  Sparkles,
  Stars,
  Tabs,
  Users,
  ArrowLeft,
  Danger,
  Sheet,
  Plane2,
} from '@/components/icons/icons';
import { SettingsGearIcon } from '@/components/icons/animated/settings-gear';
import { ArrowLeftIcon } from '@/components/icons/animated/arrow-left';
import { ShieldCheckIcon } from '@/components/icons/animated/shield';
import { KeyboardIcon } from '@/components/icons/animated/keyboard';
import { SparklesIcon } from '@/components/icons/animated/sparkles';
import { BadgeAlertIcon } from '@/components/icons/animated/alert';
import { UsersIcon } from '@/components/icons/animated/users';
import { MessageSquareIcon } from 'lucide-react';
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
        title: 'Core',
        items: [
          {
            id: 'inbox',
            title: 'navigation.sidebar.inbox',
            url: '/mail/inbox',
            icon: Inbox,
          },
          {
            id: 'drafts',
            title: 'navigation.sidebar.drafts',
            url: '/mail/draft',
            icon: Folder,
          },
          {
            id: 'sent',
            title: 'navigation.sidebar.sent',
            url: '/mail/sent',
            icon: Plane2,
          },
        ],
      },
      {
        title: 'Management',
        items: [
          {
            id: 'archive',
            title: 'navigation.sidebar.archive',
            url: '/mail/archive',
            icon: Archive,
          },
          {
            id: 'spam',
            title: 'navigation.sidebar.spam',
            url: '/mail/spam',
            icon: ExclamationCircle,
          },
          {
            id: 'trash',
            title: 'navigation.sidebar.bin',
            url: '/mail/bin',
            icon: Bin,
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
            icon: ArrowLeft,
            isBackButton: true,
          },

          {
            title: 'navigation.settings.general',
            url: '/settings/general',
            icon: SettingsGear,
          },
          {
            title: 'navigation.settings.connections',
            url: '/settings/connections',
            icon: Users,
          },
          {
            title: 'navigation.settings.appearance',
            url: '/settings/appearance',
            icon: Stars,
          },
          {
            title: 'navigation.settings.themes',
            url: '/settings/themes',
            icon: Sparkles,
          },
          {
            title: 'navigation.settings.labels',
            url: '/settings/labels',
            icon: Sheet,
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
            icon: Tabs,
          },
          // {
          //   title: 'navigation.settings.signatures',
          //   url: '/settings/signatures',
          //   icon: MessageSquareIcon,
          //   disabled: true,
          // },
          // {
          //   title: 'navigation.settings.shortcuts',
          //   url: '/settings/shortcuts',
          //   icon: Tabs,
          //   disabled: true,
          // },
          // {
          //   title: "Notifications",
          //   url: "/settings/notifications",
          //   icon: BellIcon,
          // },
          {
            title: 'navigation.settings.deleteAccount',
            url: '/settings/danger-zone',
            icon: Danger,
          },
        ].map((item) => ({
          ...item,
          isSettingsPage: true,
        })),
      },
    ],
  },
};

export const bottomNavItems = [
  {
    title: '',
    items: [
      {
        id: 'feedback',
        title: 'navigation.sidebar.feedback',
        url: 'https://feedback.0.email',
        icon: MessageSquare,
        target: '_blank',
      },
      {
        id: 'settings',
        title: 'navigation.sidebar.settings',
        url: '/settings/general',
        icon: SettingsGear,
        isSettingsButton: true,
      },
    ],
  },
];
