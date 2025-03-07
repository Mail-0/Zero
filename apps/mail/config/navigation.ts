import { SettingsGearIcon } from "@/components/icons/animated/settings-gear";
import { CheckCheckIcon } from "@/components/icons/animated/check-check";
import { ArrowLeftIcon } from "@/components/icons/animated/arrow-left";
import { BookTextIcon } from "@/components/icons/animated/book-text";
import { ShieldCheckIcon } from "@/components/icons/animated/shield";
import { KeyboardIcon } from "@/components/icons/animated/keyboard";
import { SparklesIcon } from "@/components/icons/animated/sparkles";
import { ArchiveIcon } from "@/components/icons/animated/archive";
import { UsersIcon } from "@/components/icons/animated/users";
import { InboxIcon } from "@/components/icons/animated/inbox";
import { DeleteIcon } from "@/components/icons/animated/trash";
import { XIcon } from "@/components/icons/animated/x";
export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: number;
  isBackButton?: boolean;
  isSettingsButton?: boolean;
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavConfig {
  path: string;
  sections: NavSection[];
}

export const navigationConfig: Record<string, NavConfig> = {
  mail: {
    path: "/mail",
    sections: [
      {
        title: "",
        items: [
          {
            title: "Inbox",
            url: "/mail/inbox",
            icon: InboxIcon,
          },
          {
            title: "Drafts",
            url: "/mail/draft",
            icon: BookTextIcon,
          },
          {
            title: "Sent",
            url: "/mail/sent",
            icon: CheckCheckIcon,
          },
          {
            title: "Spam",
            url: "/mail/spam",
            icon: XIcon,
          },
          {
            title: "Archive",
            url: "/mail/archive",
            icon: ArchiveIcon,
            disabled: true,
          },
          {
            title: "Bin",
            url: "/mail/bin",
            icon: DeleteIcon,
            disabled: true,
          },
          {
            title: "Settings",
            url: "/settings/general",
            icon: SettingsGearIcon,
            isSettingsButton: true,
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
      // {
      //   title: "Advanced",
      //   items: [
      //     {
      //       title: "Settings",
      //       url: "/settings",
      //       icon: SettingsGearIcon,
      //     },
      //   ],
      // },
    ],
  },
  settings: {
    path: "/settings",
    sections: [
      {
        title: "Settings",
        items: [
          {
            title: "Back",
            url: "/mail",
            icon: ArrowLeftIcon,
            isBackButton: true,
          },

          {
            title: "General",
            url: "/settings/general",
            icon: SettingsGearIcon,
          },
          {
            title: "Connections",
            url: "/settings/connections",
            icon: UsersIcon,
          },
          {
            title: "Security",
            url: "/settings/security",
            icon: ShieldCheckIcon,
          },
          {
            title: "Appearance",
            url: "/settings/appearance",
            icon: SparklesIcon,
          },
          {
            title: "Shortcuts",
            url: "/settings/shortcuts",
            icon: KeyboardIcon,
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
