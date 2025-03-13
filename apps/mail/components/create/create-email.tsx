"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ArrowUpIcon, BookText, Paperclip, Plus, X } from "lucide-react";
import { createDraft, getDraft } from "@/actions/drafts";
import { UploadedFileIcon } from "./uploaded-file-icon";
import { Separator } from "@/components/ui/separator";
import { SidebarToggle } from "../ui/sidebar-toggle";
import Paragraph from "@tiptap/extension-paragraph";
import { cn, truncateFileName } from "@/lib/utils";
import Document from "@tiptap/extension-document";
import { Button } from "@/components/ui/button";
import { generateJSON } from "@tiptap/html";
import { sendEmail } from "@/actions/send";
import Bold from "@tiptap/extension-bold";
import Text from "@tiptap/extension-text";
import { useQueryState } from "nuqs";
import { JSONContent } from "novel";
import { toast } from "sonner";
import * as React from "react";
import Editor from "./editor";
import "./prosemirror.css";

const MAX_VISIBLE_ATTACHMENTS = 12;

export function CreateEmail() {
  const [toInput, setToInput] = React.useState("");
  const [toEmails, setToEmails] = React.useState<string[]>([]);
  const [subjectInput, setSubjectInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [resetEditorKey, setResetEditorKey] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [messageContent, setMessageContent] = React.useState("");
  const [draftId, setDraftId] = useQueryState("draftId");
  const [defaultValue, setDefaultValue] = React.useState<JSONContent | null>(null);

  React.useEffect(() => {
    const loadDraft = async () => {
      if (!draftId) {
        setDefaultValue({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [],
            },
          ],
        });
        return;
      }

      try {
        const draft = await getDraft(draftId);

        if (!draft) {
          toast.error("Draft not found");
          return;
        }

        setDraftId(draft.id);

        if (draft.to?.length) {
          setToEmails(draft.to);
        }
        if (draft.subject) {
          setSubjectInput(draft.subject);
        }

        console.log("Draft content:", draft.content);

        // Set message content
        if (draft.content) {
          const json = generateJSON(draft.content, [Document, Paragraph, Text, Bold]);
          console.log("JSON:", json);
          setDefaultValue(json);
          setMessageContent(draft.content);
        }

        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Error loading draft:", error);
        toast.error("Failed to load draft");
      }
    };

    loadDraft();
  }, [draftId]);

  const hasHiddenAttachments = attachments.length > MAX_VISIBLE_ATTACHMENTS;

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = (email: string) => {
    const trimmedEmail = email.trim().replace(/,$/, "");

    if (!trimmedEmail) return;

    if (toEmails.includes(trimmedEmail)) {
      setToInput("");
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error(`Invalid email format: ${trimmedEmail}`);
      return;
    }

    setToEmails([...toEmails, trimmedEmail]);
    setToInput("");
    setHasUnsavedChanges(true);
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
      setHasUnsavedChanges(true);
    }
  };

  const saveDraft = React.useCallback(async () => {
    if (!hasUnsavedChanges) return;
    if (!toEmails.length && !subjectInput && !messageContent) return;

    try {
      setIsSaving(true);
      const draftData = {
        to: toEmails.join(", "),
        subject: subjectInput || "(no subject)",
        message: messageContent || "",
        attachments: attachments,
        id: draftId,
      };

      const response = await createDraft(draftData);

      if (response?.id && response.id !== draftId) {
        setDraftId(response.id);
      }

      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }, [toEmails, subjectInput, messageContent, attachments, draftId, hasUnsavedChanges]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const autoSaveTimer = setTimeout(() => {
      saveDraft();
    }, 3000);

    return () => clearTimeout(autoSaveTimer);
  }, [hasUnsavedChanges, saveDraft]);

  React.useEffect(() => {
    setHasUnsavedChanges(true);
  }, [messageContent]);

  const handleSendEmail = async () => {
    if (!toEmails.length) {
      toast.error("Please enter at least one recipient email address");
      return;
    }

    if (!messageContent.trim() || messageContent === JSON.stringify(defaultValue)) {
      toast.error("Please enter a message");
      return;
    }

    if (!subjectInput.trim()) {
      toast.error("Please enter a subject");
      return;
    }

    try {
      await sendEmail({
        to: toEmails.join(","),
        subject: subjectInput,
        message: messageContent,
        attachments: attachments,
      });

      toast.success("Email sent successfully");
      setToInput("");
      setToEmails([]);
      setSubjectInput("");
      setAttachments([]);
      setResetEditorKey((prev) => prev + 1);
      setMessageContent("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
      setHasUnsavedChanges(true);
    }
  };

  // Add ref for to input
  const toInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if "/" is pressed and no input/textarea is focused
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        toInputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div
      className="bg-offsetLight dark:bg-offsetDark relative flex h-full flex-col overflow-hidden shadow-inner md:rounded-2xl md:border md:shadow-sm"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="bg-background/80 border-primary/30 absolute inset-0 z-50 m-4 flex items-center justify-center rounded-2xl border-2 border-dashed backdrop-blur-sm">
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <Paperclip className="text-muted-foreground h-12 w-12" />
            <p className="text-lg font-medium">Drop files to attach</p>
          </div>
        </div>
      )}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-1.5 p-2 transition-colors">
        <SidebarToggle className="h-fit px-2" />
      </div>

      <div className="relative flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl space-y-12 px-4 pt-4 md:px-2">
            <div className="space-y-3 md:px-1">
              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  To
                </div>
                <div className="group relative left-[2px] flex w-full flex-wrap items-center gap-1 rounded-md border border-none bg-transparent p-1 transition-all focus-within:border-none focus:outline-none">
                  {toEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium"
                    >
                      <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {email}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground ml-1 rounded-full p-0.5"
                        onClick={() => {
                          setToEmails((emails) => emails.filter((_, i) => i !== index));
                          setHasUnsavedChanges(true);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    type="email"
                    className="text-md relative left-[3px] min-w-[120px] flex-1 bg-transparent opacity-50 placeholder:text-[#616161] focus:outline-none"
                    placeholder={toEmails.length ? "" : "luke@example.com"}
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === "," || e.key === "Enter" || e.key === " ") && toInput.trim()) {
                        e.preventDefault();
                        handleAddEmail(toInput);
                      } else if (e.key === "Backspace" && !toInput && toEmails.length > 0) {
                        setToEmails((emails) => emails.slice(0, -1));
                        setHasUnsavedChanges(true);
                      }
                    }}
                    onBlur={() => {
                      if (toInput.trim()) {
                        handleAddEmail(toInput);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center">
                <div className="text-muted-foreground w-20 flex-shrink-0 pr-3 text-right text-[1rem] font-[600] opacity-50 md:w-24">
                  Subject
                </div>
                <input
                  type="text"
                  className="text-md relative left-[7.5px] w-full bg-transparent placeholder:text-[#616161] placeholder:opacity-50 focus:outline-none"
                  placeholder="Subject"
                  value={subjectInput}
                  onChange={(e) => {
                    setSubjectInput(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                />
              </div>

              <div className="flex">
                <div className="text-muted-foreground text-md relative -top-[1px] w-20 flex-shrink-0 pr-3 pt-2 text-right font-[600] opacity-50 md:w-24">
                  Body
                </div>
                <div className="w-full">
                  {defaultValue && (
                    <Editor
                      initialValue={defaultValue}
                      onChange={(newContent) => setMessageContent(newContent)}
                      key={resetEditorKey}
                      placeholder="Write your message here..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-offsetLight dark:bg-offsetDark sticky bottom-0 left-0 right-0 flex items-center justify-between p-4 pb-4">
          <div>
            {attachments.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span>
                      {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 touch-auto" align="start">
                  <div className="space-y-2">
                    <div className="px-1">
                      <h4 className="font-medium leading-none">Attachments</h4>
                      <p className="text-muted-foreground text-sm">
                        {attachments.length} file{attachments.length !== 1 ? "s" : ""} attached
                      </p>
                    </div>
                    <Separator />
                    <div className="h-[300px] touch-auto overflow-y-auto overscroll-contain px-1 py-1">
                      <div className="grid grid-cols-2 gap-2">
                        {attachments.map((file, index) => (
                          <div
                            key={index}
                            className="group relative overflow-hidden rounded-md border"
                          >
                            <UploadedFileIcon
                              removeAttachment={(index) =>
                                setAttachments((attachments) =>
                                  attachments.filter((_, i) => i !== index),
                                )
                              }
                              index={index}
                              file={file}
                            />
                            <div className="bg-muted/10 p-2">
                              <p className="text-xs font-medium">
                                {truncateFileName(file.name, 20)}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => document?.getElementById("file-upload")?.click()}
            >
              <Plus className="mr-1 h-4 w-4" />
              Attachments
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              multiple
              onChange={handleAttachment}
            />
            <Button
              variant="outline"
              className={cn(
                "group relative w-9 overflow-hidden transition-all duration-200 hover:w-32",
                {
                  "w-32": isSaving,
                },
                hasUnsavedChanges
                  ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                  : "bg-green-500/10 text-green-500 hover:bg-green-500/20",
              )}
              onClick={saveDraft}
              // disabled={isSaving || !state.hasUnsavedChanges}
            >
              <BookText className="absolute left-[9px] h-6 w-6" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {isSaving ? (
                  <>
                    <span className="animate-pulse">Saving...</span>
                  </>
                ) : hasUnsavedChanges ? (
                  <>Save draft</>
                ) : (
                  <>Draft saved</>
                )}
              </span>
            </Button>
            <Button
              variant="default"
              className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-24"
              onClick={handleSendEmail}
              disabled={
                !toEmails.length ||
                !messageContent.trim() ||
                messageContent === JSON.stringify(defaultValue)
              }
            >
              <ArrowUpIcon className="absolute left-2.5 h-4 w-4" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Send
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
