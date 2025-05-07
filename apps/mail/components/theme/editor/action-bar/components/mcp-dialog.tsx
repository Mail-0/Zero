import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Check, Copy } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import TabsTriggerPill from "../../theme-preview/tabs-trigger-pill";

interface MCPDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const mcpConfig = {
  mcpServers: {
    shadcn: {
      command: "npx",
      args: ["-y", "shadcn@canary", "registry:mcp"],
      env: {
        REGISTRY_URL: "https://tweakcn.com/r/themes/registry.json",
      },
    },
  },
};

export function MCPDialog({ open, onOpenChange }: MCPDialogProps) {
  const { hasCopied, copyToClipboard } = useCopyToClipboard();
  const posthog = usePostHog();

  const handleCopy = async (config: typeof mcpConfig) => {
    copyToClipboard(JSON.stringify(config, null, 2));
    posthog.capture("COPY_MCP_SETUP");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 py-6 overflow-hidden rounded-lg border shadow-lg gap-6">
        <DialogHeader className="px-6">
          <DialogTitle>Setup MCP</DialogTitle>
          <DialogDescription>
            Use the code below to configure the registry in your IDE.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
          <Tabs defaultValue="cursor" className="w-full">
            <TabsList className="inline-flex w-fit items-center justify-center rounded-full bg-background px-0 mb-2 text-muted-foreground">
              <TabsTriggerPill value="cursor">Cursor</TabsTriggerPill>
              <TabsTriggerPill value="windsurf">Windsurf</TabsTriggerPill>
            </TabsList>

            <div className="flex-1 min-h-0 flex flex-col rounded-lg border overflow-hidden">
              <div className="flex-none flex justify-between items-center px-4 py-2 border-b bg-muted/50">
                <TabsContent value="cursor" className="contents">
                  <p className="text-sm font-medium text-muted-foreground">
                    Copy and paste the code into{" "}
                    <span className="bg-muted rounded-md px-1 text-foreground">
                      .cursor/mcp.json
                    </span>
                  </p>
                </TabsContent>
                <TabsContent value="windsurf" className="contents">
                  <p className="text-sm font-medium text-muted-foreground">
                    Copy and paste the code into{" "}
                    <span className="bg-muted rounded-md px-1 text-foreground">
                      .codeium/windsurf/mcp_config.json
                    </span>
                  </p>
                </TabsContent>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(mcpConfig)}
                  className="h-8"
                  aria-label={hasCopied ? "Copied to clipboard" : "Copy to clipboard"}
                >
                  {hasCopied ? (
                    <>
                      <Check className="size-4" />
                      <span className="sr-only md:not-sr-only">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      <span className="sr-only md:not-sr-only">Copy</span>
                    </>
                  )}
                </Button>
              </div>

              <pre className="h-full p-4 text-sm">
                <code>{JSON.stringify(mcpConfig, null, 2)}</code>
              </pre>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
