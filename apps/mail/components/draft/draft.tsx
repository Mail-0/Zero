"use client";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AlignVerticalSpaceAround, Trash2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SearchIcon } from "../icons/animated/search";
import { SidebarToggle } from "../ui/sidebar-toggle";
import { useDrafts } from "./draftHooks/useDrafts";
import { Button } from "@/components/ui/button";
import { DraftType } from "@/store/draftStates";
import { useState } from "react";
import * as React from "react";

export function Draft() {
  const { drafts, addDraft, removeDraft } = useDrafts();

  // Todo: store this in cookies / local storage
  const [isCompact, setIsCompact] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<DraftType | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // checking if the screen is mobile
  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIsMobile();
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Handle changes to subject or message
  const handleInputChange = (field: "subject" | "message", value: string) => {
    if (!selectedDraft) return;
    setSelectedDraft((prevDraft) => {
      if (!prevDraft) return null;
      return { ...prevDraft, [field]: value };
    });
  };

  const editMail = () => {
    if (!selectedDraft) return;
    addDraft(selectedDraft);
    setSelectedDraft(null); // closing panel after editing
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-dvh">
        <ResizablePanelGroup direction="horizontal" autoSaveId="draft-panel-layout">
          <ResizablePanel defaultSize={isMobile ? 100 : 35} minSize={isMobile ? 100 : 35}>
            <div className="flex-1 overflow-y-auto border-r">
              <Tabs defaultValue="all">
                <div className="flex items-center justify-between p-4">
                  <SidebarToggle className="block md:hidden" />
                  <h1 className="hidden text-xl font-bold md:block">Drafts</h1>
                  <div className="flex items-center space-x-1.5">
                    <Button variant="ghost" size="icon" onClick={() => setIsCompact(!isCompact)}>
                      <AlignVerticalSpaceAround />
                    </Button>
                  </div>
                </div>
                <div className="bg-background backdrop-blur supports-[backdrop-filter]:bg-background">
                  <form className="flex space-x-1.5 p-4 pt-0">
                    <div className="flex w-full items-center space-x-3 rounded-md border p-2 px-3">
                      <SearchIcon />
                      <input
                        type="text"
                        className="w-full flex-1 border-none bg-background outline-none"
                        placeholder="Search drafts"
                      />
                    </div>
                  </form>
                </div>
                <Separator />
                <TabsContent value="all" className="m-0">
                  {drafts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No drafts available</div>
                  ) : (
                    <div className="space-y-1">
                      {drafts.map((draft) => (
                        <div
                          key={draft.id}
                          className={`flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-secondary/80 ${
                            selectedDraft?.id === draft.id ? "bg-secondary" : ""
                          }`}
                          onClick={() => {
                            setSelectedDraft(draft); // selecting the draft
                          }}
                        >
                          <div className="mr-4 min-w-0 flex-1">
                            <h3 className="truncate font-medium">
                              {draft.subject || "No subject"}
                            </h3>
                            <p className="mt-1 truncate text-sm text-muted-foreground">
                              {draft.message?.substring(0, 50) || "No message"}...
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="ghost"
                              size="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeDraft(draft.id);
                              }}
                              className="opacity-100 hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>

          {/* draft editor */}
          {!isMobile && selectedDraft && <ResizableHandle withHandle />}
          {selectedDraft && (
            <ResizablePanel
              defaultSize={isMobile ? 0 : 65}
              minSize={isMobile ? 0 : 25}
              className="hidden md:block"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={editMail} // save the updated draft
                      variant="ghost"
                      size="sm"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => {
                        removeDraft(selectedDraft.id); // Remove the draft
                        setSelectedDraft(null);
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      Discard
                    </Button>
                  </div>
                  <Button variant="default" size="sm">
                    Send
                  </Button>
                </div>
                <Separator />
                <div className="flex-1 overflow-y-auto p-4">
                  <input
                    type="text"
                    placeholder="Subject"
                    className="mb-4 w-full rounded-md border bg-background p-2"
                    value={selectedDraft.subject || ""}
                    onChange={(e) => handleInputChange("subject", e.target.value)}
                  />
                  <textarea
                    placeholder="Write your message..."
                    className="h-[calc(100%-120px)] w-full resize-none rounded-md border bg-background p-2"
                    value={selectedDraft.message || ""}
                    onChange={(e) => handleInputChange("message", e.target.value)}
                  />
                </div>
              </div>
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
