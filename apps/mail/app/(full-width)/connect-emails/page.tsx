"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { ArrowRight, Loader2, Plus, Trash } from "lucide-react";
import { useConnections } from "@/hooks/use-connections";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { toast } from "sonner";
import Link from "next/link";
import axios from "axios";

export default function ConnectEmails() {
  const { data: connections, mutate, isLoading: loading } = useConnections();

  const disconnectAccount = async (connectionId: string) => {
    try {
      await axios.delete(`/api/v1/mail/connections/${connectionId}`);
      toast.success("Account disconnected successfully");
      mutate(); // Refresh the list
    } catch (error) {
      console.error("Error disconnecting account:", error);
      toast.error("Failed to disconnect account");
    }
  };

  const emailProviders = [
    {
      name: "Google",
      icon: "M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z",
      providerId: "google",
    },
    // {
    //   name: "Outlook",
    //   icon: "M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.102.085.229.126.379.126.148 0 .277-.041.389-.127L24 7.387zm-9.365-2.021h8.547c.211 0 .393.063.543.192.15.128.234.3.248.51l-7.369 5.876-1.969-1.549V5.366zM13.404.864v22.271L0 20.819V3.244L13.406.864h-.002zm-4.049 11.18c-.02-1.133-.313-2.072-.879-2.814-.555-.74-1.275-1.131-2.131-1.164-.824.033-1.529.423-2.1 1.164-.57.742-.855 1.682-.87 2.814.015 1.117.315 2.047.885 2.791.571.74 1.274 1.133 2.101 1.176.855-.035 1.574-.424 2.145-1.17.57-.748.87-1.68.885-2.797h-.036zm-3.12-2.482c.431.02.794.256 1.083.717.285.461.435 1.045.435 1.752 0 .721-.149 1.307-.435 1.771-.301.464-.66.704-1.096.704s-.795-.226-1.095-.69-.435-1.05-.435-1.754c0-.705.135-1.291.435-1.74.284-.45.646-.69 1.096-.721l.012-.039z",
    // },
    // {
    //   name: "Yahoo",
    //   icon: "M12.6 4.2l3.2 7.5 3.3-7.5h4.8L16 24h-4.9l2.4-5.5L8.6 4.2h4zm-5.8 0l2.9 7.1-1.3 3.1L3.6 4.2h3.2z",
    // },
    // {
    //   name: "ProtonMail",
    //   icon: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2zm0 3c-3.866 0-7 3.134-7 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zm0 2c2.757 0 5 2.243 5 5s-2.243 5-5 5-5-2.243-5-5 2.243-5 5-5zm0 2c-1.654 0-3 1.346-3 3s1.346 3 3 3 3-1.346 3-3-1.346-3-3-3z",
    // },
  ];

  return (
    <div className="flex h-dvh w-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-sm flex-col gap-2 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-1 px-4 text-center">
          <h3 className="text-xl font-semibold dark:text-zinc-50">Connect your emails</h3>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Connect your emails to your Mail0 account
          </p>
        </div>
        <div className="px-4 sm:px-0">
          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          ) : connections ? (
            connections.length > 0 ? (
              <div className="space-y-3">
                {connections?.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {connection.picture ? (
                        <Image
                          src={connection.picture || "/placeholder.svg"}
                          alt=""
                          className="h-12 w-12 rounded-xl object-cover"
                          width={48}
                          height={48}
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            className="h-6 w-6 text-primary"
                          >
                            <path
                              fill="currentColor"
                              d="M11.99 13.9v-3.72h9.36c.14.63.25 1.22.25 2.05c0 5.71-3.83 9.77-9.6 9.77c-5.52 0-10-4.48-10-10S6.48 2 12 2c2.7 0 4.96.99 6.69 2.61l-2.84 2.76c-.72-.68-1.98-1.48-3.85-1.48c-3.31 0-6.01 2.75-6.01 6.12s2.7 6.12 6.01 6.12c3.83 0 5.24-2.65 5.5-4.22h-5.51z"
                            />
                          </svg>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{connection.email}</span>
                        <span className="text-xs text-muted-foreground">Connected</span>
                      </div>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Trash className="h-4 w-4" />
                          <span className="sr-only">Disconnect account</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Disconnect Email Account</DialogTitle>
                          <DialogDescription className="text-sm">
                            Are you sure you want to disconnect this email?
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end gap-4">
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button onClick={() => disconnectAccount(connection.id)}>Remove</Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                ))}
              </div>
            ) : null
          ) : null}
        </div>
        <div className="flex justify-center gap-2 px-4 sm:px-16">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <Plus className="h-4 w-4" />
                {connections ? (connections.length > 0 ? "Add Email" : "Connect Email") : "..."}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center">Connect Email</DialogTitle>
                <DialogDescription className="text-center text-muted-foreground">
                  Select the email providers you want to connect
                </DialogDescription>
              </DialogHeader>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-2">
                {emailProviders.map((provider) => (
                  <a key={provider.name} href={`/api/v1/mail/auth/${provider.providerId}/init`}>
                    <Button
                      variant="outline"
                      className="flex h-24 w-full flex-col items-center justify-center gap-2 p-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        className="h-12 w-12"
                      >
                        <path fill="currentColor" d={provider.icon} />
                      </svg>
                      <span className="text-xs">{provider.name}</span>
                    </Button>
                  </a>
                ))}
                <Button
                  variant="outline"
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 border-dashed p-0"
                >
                  <Plus className="h-12 w-12" />
                  <span className="text-xs">More Coming Soon</span>
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Link href="/mail" className="w-full">
            <Button className="w-full gap-2" disabled={!connections?.length}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
