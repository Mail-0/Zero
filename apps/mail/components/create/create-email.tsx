"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { compressText, decompressText, truncateFileName } from "@/lib/utils";
import { ArrowUpIcon, Paperclip, Plus, X } from "lucide-react";
import { UploadedFileIcon } from "./uploaded-file-icon";
import { Separator } from "@/components/ui/separator";
import { SidebarToggle } from "../ui/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { sendEmail } from "@/actions/send";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import * as React from "react";
import Editor from "./editor";
import "./prosemirror.css";

const MAX_VISIBLE_ATTACHMENTS = 12;

export const defaultValue = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
};

interface EmailState {
  toInput: string;
  toEmails: string[];
  subjectInput: string;
  attachments: File[];
  resetEditorKey: number;
  isAISidebarOpen: boolean;
  isDragging: boolean;
}

type EmailAction =
  | { type: "SET_TO_INPUT"; payload: string }
  | { type: "ADD_EMAIL"; payload: string }
  | { type: "REMOVE_EMAIL"; payload: number }
  | { type: "SET_SUBJECT_INPUT"; payload: string }
  | { type: "SET_ATTACHMENTS"; payload: File[] }
  | { type: "ADD_ATTACHMENTS"; payload: File[] }
  | { type: "REMOVE_ATTACHMENT"; payload: number }
  | { type: "RESET_EDITOR" }
  | { type: "TOGGLE_AI_SIDEBAR"; payload: boolean }
  | { type: "SET_DRAGGING"; payload: boolean }
  | { type: "RESET_FORM" };

function emailReducer(state: EmailState, action: EmailAction): EmailState {
  switch (action.type) {
    case "SET_TO_INPUT":
      return { ...state, toInput: action.payload };
    case "ADD_EMAIL":
      return {
        ...state,
        toEmails: [...state.toEmails, action.payload],
        toInput: "",
      };
    case "REMOVE_EMAIL":
      return {
        ...state,
        toEmails: state.toEmails.filter((_, i) => i !== action.payload),
      };
    case "SET_SUBJECT_INPUT":
      return { ...state, subjectInput: action.payload };
    case "SET_ATTACHMENTS":
      return { ...state, attachments: action.payload };
    case "ADD_ATTACHMENTS":
      return { ...state, attachments: [...state.attachments, ...action.payload] };
    case "REMOVE_ATTACHMENT":
      return {
        ...state,
        attachments: state.attachments.filter((_, i) => i !== action.payload),
      };
    case "RESET_EDITOR":
      return { ...state, resetEditorKey: state.resetEditorKey + 1 };
    case "TOGGLE_AI_SIDEBAR":
      return { ...state, isAISidebarOpen: action.payload };
    case "SET_DRAGGING":
      return { ...state, isDragging: action.payload };
    case "RESET_FORM":
      return {
        ...state,
        toInput: "",
        toEmails: [],
        subjectInput: "",
        attachments: [],
        resetEditorKey: state.resetEditorKey + 1,
      };
    default:
      return state;
  }
}

export function CreateEmail() {
  const [state, dispatch] = React.useReducer(emailReducer, {
    toInput: "",
    toEmails: [],
    subjectInput: "",
    attachments: [],
    resetEditorKey: 0,
    isAISidebarOpen: false,
    isDragging: false,
  });

  const { toInput, subjectInput, attachments, resetEditorKey, isAISidebarOpen, isDragging } = state;

  const [messageContent, setMessageContent] = useQueryState("body", {
    defaultValue: "",
    parse: (value) => decompressText(value),
    serialize: (value) => compressText(value),
  });

  const hasHiddenAttachments = attachments.length > MAX_VISIBLE_ATTACHMENTS;

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddEmail = (email: string) => {
    const trimmedEmail = email.trim().replace(/,$/, "");

    if (!trimmedEmail) return;

    if (state.toEmails.includes(trimmedEmail)) {
      dispatch({ type: "SET_TO_INPUT", payload: "" });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error(`Invalid email format: ${trimmedEmail}`);
      return;
    }

    dispatch({ type: "ADD_EMAIL", payload: trimmedEmail });
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      dispatch({ type: "ADD_ATTACHMENTS", payload: Array.from(e.target.files) });
    }
  };

  const handleSendEmail = async () => {
    if (!state.toEmails.length) {
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
        to: state.toEmails.join(","),
        subject: subjectInput,
        message: messageContent,
        attachments: attachments,
      });

      toast.success("Email sent successfully");
      dispatch({ type: "RESET_FORM" });
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Failed to send email. Please try again.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "SET_DRAGGING", payload: true });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "SET_DRAGGING", payload: false });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: "SET_DRAGGING", payload: false });
    
    if (e.dataTransfer.files) {
      dispatch({ type: "ADD_ATTACHMENTS", payload: Array.from(e.dataTransfer.files) });
    }
  };

  // Add ref for to input
  const toInputRef = React.useRef<HTMLInputElement>(null);

  // Add keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if "/" is pressed and no input/textarea is focused
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        toInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div 
      className="bg-offsetLight dark:bg-offsetDark flex h-full flex-col overflow-hidden shadow-inner md:rounded-2xl md:border md:shadow-sm relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center border-2 border-dashed border-primary/30 rounded-2xl m-4">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Paperclip className="h-12 w-12 text-muted-foreground" />
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
                  {state.toEmails.map((email, index) => (
                    <div
                      key={index}
                      className="border flex items-center gap-1 rounded-md px-2 py-1  font-medium text-sm"
                    >
                      <span className="max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {email}
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground ml-1 rounded-full p-0.5"
                        onClick={() => dispatch({ type: "REMOVE_EMAIL", payload: index })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <input
                    ref={toInputRef}
                    type="email"
                    className="text-md min-w-[120px] flex-1 bg-transparent placeholder:text-[#616161] opacity-50 focus:outline-none relative left-[3px]"
                    placeholder={state.toEmails.length ? "" : "luke@example.com"}
                    value={toInput}
                    onChange={(e) => dispatch({ type: "SET_TO_INPUT", payload: e.target.value })}
                    onKeyDown={(e) => {
                      if ((e.key === "," || e.key === "Enter" || e.key === " ") && toInput.trim()) {
                        e.preventDefault();
                        handleAddEmail(toInput);
                      } else if (e.key === "Backspace" && !toInput && state.toEmails.length > 0) {
                        dispatch({ type: "REMOVE_EMAIL", payload: state.toEmails.length - 1 });
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
                  className="placeholder:text-[#616161] text-md relative left-[7.5px] w-full bg-transparent placeholder:opacity-50 focus:outline-none"
                  placeholder="Subject"
                  value={subjectInput}
                  onChange={(e) => dispatch({ type: "SET_SUBJECT_INPUT", payload: e.target.value })}
                />
              </div>

              <div className="flex">
                <div className="text-muted-foreground text-md relative -top-[1px] w-20 flex-shrink-0 pr-3 pt-2 text-right font-[600] opacity-50 md:w-24">
                  Body
                </div>
                <div className="w-full">
                  <Editor
                    initialValue={defaultValue}
                    onChange={(newContent) => setMessageContent(newContent)}
                    key={resetEditorKey}
                    placeholder="Write your message here..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-offsetLight dark:bg-offsetDark sticky bottom-0 left-0 right-0 flex items-center justify-between p-4 pb-6">
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
                                dispatch({ type: "REMOVE_ATTACHMENT", payload: index })
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
              className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-32"
              onClick={() => document?.getElementById("file-upload")?.click()}
            >
              <Plus className="absolute left-[9px] h-6 w-6" />
              <span className="whitespace-nowrap pl-7 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Attachments
              </span>
            </Button>
            <input
              id="file-upload"
              type="file"
              className="hidden"
              multiple
              onChange={handleAttachment}
            />
            <Button
              variant="default"
              className="group relative w-9 overflow-hidden transition-all duration-200 hover:w-24"
              onClick={handleSendEmail}
              disabled={
                !state.toEmails.length ||
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