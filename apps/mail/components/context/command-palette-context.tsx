"use client";

import * as React from "react";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator } from "@/components/ui/command";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useOpenComposeModal } from "@/hooks/use-open-compose-modal";
import { useConnections } from "@/hooks/use-connections";
import { useSession, $fetch } from "@/lib/auth-client";
import { navigationConfig, NavItem } from "@/config/navigation";
import { keyboardShortcuts } from "@/config/shortcuts";
import { ArrowUpRight, CircleHelp, Pencil } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { IConnection } from "@/types";

type Props = {
  children?: React.ReactNode | React.ReactNode[];
};

type CommandPaletteContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openModal: () => void;
};

const CommandPaletteContext = React.createContext<CommandPaletteContext | null>(null);

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}

/**
 * The main command palette component (restored to its original name).
 * It now includes the new account-switching logic you introduced.
 */
export function CommandPalette({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const { open: openComposeModal } = useOpenComposeModal();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, refetch } = useSession();
  const { data: connections, mutate } = useConnections();

  // Listen for Ctrl/Cmd + K to toggle the palette
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Utility for closing the palette and running any command
  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    setSearchValue("");
    command();
  }, []);

  // Example of your "allCommands" navigation logic (adjust as needed)
  const allCommands = React.useMemo(() => {
    // your grouped navigation commands from config, etc.
    // ...
    return navigationConfig;
  }, [pathname]);

  // ---- ACCOUNT SWITCHING LOGIC ----
  const accountCommands = React.useMemo(() => {
    if (!session?.user || !connections?.length) {
      return [];
    }
    return connections
      .filter((c) => c.id !== session.connectionId)
      .map((connection: IConnection) => ({
        group: "Accounts",
        item: {
          title: `Switch to ${connection.email}`,
          icon: () => (
            <Image
              src={connection.picture || "/placeholder.svg"}
              alt={connection.name || connection.email}
              width={16}
              height={16}
              className="h-4 w-4 rounded-full"
            />
          ),
          onSelect: () => {
            runCommand(() => {
              // 1) PUT to backend to update default connection
              fetch(`/api/v1/mail/connections/${connection.id}`, { method: "PUT" })
                .then((response) => {
                  if (response.ok) {
                    return $fetch("/api/auth/session", {
                      method: "POST",
                      body: JSON.stringify({ connectionId: connection.id }),
                    });
                  } else {
                    response.json().then((data) => {
                      toast.error("Error switching connection", {
                        description: data.error,
                      });
                    });
                    throw new Error("Failed to update default connection ID");
                  }
                })
                .then(() => {
                  // 2) Refetch session & connections, refresh router
                  refetch();
                  mutate();
                  router.refresh();
                  toast.success(`Successfully switched to account: ${connection.email}`);
                })
                .catch((error) => {
                  toast.error("Error switching connection", { description: String(error) });
                });
            });
          },
        },
      }));
  }, [session, connections, runCommand, refetch, mutate, router]);

  // Filter your existing commands and account commands by searchValue
  const filteredAllCommands = React.useMemo(() => {
    const searchTerm = searchValue.toLowerCase();
    return allCommands
      .map((group) => ({
        ...group,
        items: group.items.filter((item: NavItem) => item.title.toLowerCase().includes(searchTerm)),
      }))
      .filter((group) => group.items.length > 0);
  }, [allCommands, searchValue]);

  const filteredAccountCommands = React.useMemo(() => {
    const term = searchValue.toLowerCase();
    return accountCommands.filter(
      (ac) => ac.item.title.toLowerCase().includes(term) || "switch".includes(term),
    );
  }, [accountCommands, searchValue]);

  return (
    <CommandPaletteContext.Provider
      value={{
        open,
        setOpen,
        openModal: () => {
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
        <CommandInput
          autoFocus
          placeholder="Type a command or search..."
          value={searchValue}
          onValueChange={setSearchValue}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {/* Example: "New Draft" command group */}
          <CommandGroup>
            <CommandItem onSelect={() => runCommand(openComposeModal)}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>New Draft</span>
              <CommandShortcut>{keyboardShortcuts["newDraft"]}</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {/* Render filtered navigation commands */}
          {filteredAllCommands.map((group, i) => (
            <React.Fragment key={i}>
              {!!group.items.length && (
                <CommandGroup heading={group.group}>
                  {group.items.map((item, j) => (
                    <CommandItem key={j} onSelect={() => runCommand(item.onSelect)}>
                      {item.icon && item.icon()}
                      {item.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {i < filteredAllCommands.length - 1 && <CommandSeparator />}
            </React.Fragment>
          ))}

          {/* Render filtered account commands */}
          {filteredAccountCommands.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Accounts">
                {filteredAccountCommands.map((ac, i) => (
                  <CommandItem key={i} onSelect={ac.item.onSelect}>
                    {ac.item.icon && ac.item.icon()}
                    <span>{ac.item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Help group */}
          <CommandSeparator />
          <CommandGroup heading="Help">
            <CommandItem onSelect={() => runCommand(() => console.log("Help with shortcuts"))}>
              <CircleHelp className="mr-2 h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runCommand(() => window.open("https://github.com/Mail-0/Mail-0/issues/new/choose"))
              }
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              <span>Report an Issue</span>
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
