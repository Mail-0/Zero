"use client";

import { useKeyCombinationActions } from "@/hooks/use-key-combination-actions";
import { navigationConfig } from "@/config/navigation";
import { useRouter } from "next/navigation";

export const Shortcutter = () => {
  const router = useRouter();
  useKeyCombinationActions({
    config: [
      {
        shortcut: ["g", "1"],
        action: () => router.push(navigationConfig.mail.sections[0].items[0].url),
      },
      {
        shortcut: ["g", "2"],
        action: () => router.push(navigationConfig.mail.sections[0].items[1].url),
      },
      {
        shortcut: ["g", "3"],
        action: () => router.push(navigationConfig.mail.sections[0].items[2].url),
      },
      {
        shortcut: ["g", "4"],
        action: () => router.push(navigationConfig.mail.sections[0].items[3].url),
      },
      {
        shortcut: ["g", "5"],
        action: () => router.push(navigationConfig.mail.sections[0].items[4].url),
      },
      {
        shortcut: ["g", "6"],
        action: () => router.push(navigationConfig.mail.sections[0].items[5].url),
      },
      {
        shortcut: ["g", "7"],
        action: () => router.push(navigationConfig.mail.sections[0].items[6].url),
      },
      {
        shortcut: ["g", "8"],
        action: () => router.push(navigationConfig.mail.sections[0].items[7].url),
      },
      {
        shortcut: ["g", "9"],
        action: () => router.push(navigationConfig.mail.sections[0].items[8].url),
      },
    ],
  });

  return null;
};
