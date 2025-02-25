import { Tag } from "@/components/mail/use-tags";
import { Mail } from "@/components/mail/data";
import { useMemo } from "react";

/**
 * Custom hook for filtering mails based on active tags
 * @param mails - Array of mail objects to filter
 * @param activeTags - Array of currently active tag objects
 * @returns Array of filtered mail objects
 */
export const useFilteredMails = (mails: Mail[], activeTags: Tag[]) => {
  // Create a lookup object for active tags
  const activeTagLookup = useMemo(() => {
    const lookup: Record<string, boolean> = {};
    activeTags.forEach((tag) => {
      lookup[tag.label.toLowerCase()] = true;
    });
    return lookup;
  }, [activeTags]);

  // Filter mails based on active tags
  const filteredMails = useMemo(() => {
    if (activeTags.length === 0) return mails;

    return mails.filter((mail) =>
      mail.labels.some((label) => activeTagLookup[label.toLowerCase()]),
    );
  }, [mails, activeTagLookup, activeTags.length]);

  return filteredMails;
};
