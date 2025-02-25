"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useOpenComposeModal } from "@/hooks/use-open-compose-modal";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { navigationConfig, NavItem } from "@/config/navigation";
import { useRouter, usePathname } from "next/navigation";
import { keyboardShortcuts } from "@/config/shortcuts";
import { ArrowUpRight } from "lucide-react";
import { CircleHelp } from "lucide-react";
import { Pencil } from "lucide-react";
import * as React from "react";

type CommandPaletteContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
};

type Props = {
  children?: React.ReactNode | React.ReactNode[];
};

const CommandPaletteContext = React.createContext<CommandPaletteContext | null>(null);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider.");
  }
  return context;
}

export function CommandPalette({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { open: openComposeModal } = useOpenComposeModal(); // Correctly use open function
  const router = useRouter();
  const pathname = usePathname();
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prevOpen) => !prevOpen);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  const allCommands = React.useMemo(() => {
    const mailCommands: { group: string; item: NavItem }[] = [];
    const settingsCommands: { group: string; item: NavItem }[] = [];
    const otherCommands: { group: string; item: NavItem }[] = [];

    for (const sectionKey in navigationConfig) {
      const section = navigationConfig[sectionKey];
      section.sections.forEach((group) => {
        group.items.forEach((item) => {
          if (!(sectionKey === "settings" && item.isBackButton)) {
            if (sectionKey === "mail") {
              mailCommands.push({ group: sectionKey, item });
            } else if (sectionKey === "settings") {
              settingsCommands.push({ group: sectionKey, item });
            } else {
              otherCommands.push({ group: sectionKey, item });
            }
          } else if (sectionKey === "settings") {
            settingsCommands.push({ group: sectionKey, item });
          }
        });
      });
    }

    const combinedCommands = [
      { group: "Mail", items: mailCommands.map((c) => c.item) },
      { group: "Settings", items: settingsCommands.map((c) => c.item) },
      ...otherCommands.map((section) => ({ group: section.group, items: section.item })),
    ];

    const filteredCommands = combinedCommands.map((group) => {
      if (group.group === "Settings") {
        return {
          ...group,
          items: group.items.filter((item: NavItem) => {
            return pathname.startsWith("/settings") || !item.isBackButton;
          }),
        };
      }
      return group;
    });

    return filteredCommands;
  }, [pathname]);

  return (
    <CommandPaletteContext.Provider
      value={{
        open,
        setOpen,
        openModal: () => {
          // Use openModal from context
          setOpen(false);
          openComposeModal();
        },
      }}
    >
      <CommandDialog open={open} onOpenChange={setOpen}>
        <VisuallyHidden>
          <DialogTitle>0 - Command Palette</DialogTitle>
          <DialogDescription>Quick navigation and actions for 0.</DialogDescription>
        </VisuallyHidden>
        <CommandInput autoFocus placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup>
            <CommandItem onSelect={() => runCommand(() => openComposeModal())}>
              <Pencil size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <span>Compose message</span>
              <CommandShortcut>
                {keyboardShortcuts
                  .find((s: { action: string; keys: string[] }) => s.action === "New Email")
                  ?.keys.join(" ")}
              </CommandShortcut>
            </CommandItem>
          </CommandGroup>
          {allCommands.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.items.length > 0 && (
                <CommandGroup heading={group.group}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.url}
                      onSelect={() =>
                        runCommand(() => {
                          router.push(item.url);
                        })
                      }
                    >
                      {item.icon && (
                        <item.icon
                          size={16}
                          strokeWidth={2}
                          className="opacity-60"
                          aria-hidden="true"
                        />
                      )}
                      <span>{item.title}</span>
                      {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groupIndex < allCommands.length - 1 && <CommandSeparator />}
            </React.Fragment>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Help">
            <CommandItem onSelect={() => runCommand(() => console.log("Help with shortcuts"))}>
              <CircleHelp size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <span>Help with shortcuts</span>
              <CommandShortcut>
                {keyboardShortcuts
                  .find(
                    (s: { action: string; keys: string[] }) => s.action === "Help with shortcuts",
                  )
                  ?.keys.join(" ")}
              </CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => window.open("https://github.com/nizzyabi/mail0", "_blank"))
              }
            >
              <ArrowUpRight size={16} strokeWidth={2} className="opacity-60" aria-hidden="true" />
              <span>Go to docs</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export const CommandPaletteProvider = ({ children }: Props) => {
  return (
    <React.Suspense>
      <CommandPalette>{children}</CommandPalette>
    </React.Suspense>
  );
};
