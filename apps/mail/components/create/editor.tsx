"use client";

import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  type JSONContent,
} from "novel";
import { LinkSelector } from "@/components/create/selectors/link-selector";
import { NodeSelector } from "@/components/create/selectors/node-selector";
import { TextButtons } from "@/components/create/selectors/text-buttons";
import { suggestionItems } from "@/components/create/slash-command";
import { defaultExtensions } from "@/components/create/extensions";
import { ImageResizer, handleCommandNavigation } from "novel";
import { uploadFn } from "@/components/create/image-upload";
import { handleImageDrop, handleImagePaste } from "novel";
import EditorMenu from "@/components/create/editor-menu";
import { Separator } from "@/components/ui/separator";
import { useReducer, useRef } from "react";
import "./editor.css";

const hljs = require("highlight.js");

const extensions = [...defaultExtensions];

export const defaultEditorContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [],
    },
  ],
};

interface EditorProps {
  initialValue?: JSONContent;
  onChange: (content: string) => void;
  placeholder?: string;
}

interface EditorState {
  openNode: boolean;
  openColor: boolean;
  openLink: boolean;
  openAI: boolean;
}

type EditorAction =
  | { type: "TOGGLE_NODE"; payload: boolean }
  | { type: "TOGGLE_COLOR"; payload: boolean }
  | { type: "TOGGLE_LINK"; payload: boolean }
  | { type: "TOGGLE_AI"; payload: boolean };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "TOGGLE_NODE":
      return { ...state, openNode: action.payload };
    case "TOGGLE_COLOR":
      return { ...state, openColor: action.payload };
    case "TOGGLE_LINK":
      return { ...state, openLink: action.payload };
    case "TOGGLE_AI":
      return { ...state, openAI: action.payload };
    default:
      return state;
  }
}

export default function Editor({ initialValue, onChange, placeholder = "Write something..." }: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, {
    openNode: false,
    openColor: false,
    openLink: false,
    openAI: false,
  });
  
  // Add a ref to store the editor content to prevent losing it on refresh
  const contentRef = useRef<string>("");

  const { openNode, openColor, openLink, openAI } = state;

  return (
    <div 
      className="relative w-full max-w-[450px] sm:max-w-[600px]"
      onKeyDown={(e) => {
        // Prevent form submission on Enter key
        if (e.key === 'Enter' && !e.shiftKey) {
          e.stopPropagation();
        }
      }}
    >
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          initialContent={initialValue}
          extensions={extensions}
          className="min-h-96 max-w-[450px] sm:max-w-[600px]"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) =>
              handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class:
                "prose dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full",
              "data-placeholder": placeholder,
            },
          }}
          onUpdate={({ editor }) => {
            // Store the content in the ref to prevent losing it
            contentRef.current = editor.getHTML();
            onChange(editor.getHTML());
          }}
          slotAfter={<ImageResizer />}
        >
          {/* Make sure the command palette doesn't cause a refresh */}
          <EditorCommand 
            className="border-muted bg-background z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border px-1 py-2 shadow-md transition-all"
            onKeyDown={(e) => {
              // Prevent form submission on any key that might trigger it
              if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {/* Rest of the command palette */}
            <EditorCommandEmpty className="text-muted-foreground px-2">
              No results
            </EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  onCommand={(val) => {
                    // Prevent default behavior that might cause refresh
                    item.command?.(val);
                    return false;
                  }}
                  className="hover:bg-accent aria-selected:bg-accent flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-[10px]"
                  key={item.title}
                >
                  <div className="border-muted bg-background flex h-8 w-8 items-center justify-center rounded-md border">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-[8px]">{item.description}</p>
                  </div>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>

          {/* Rest of the editor menu */}
          <EditorMenu
            open={openAI}
            onOpenChange={(open) => dispatch({ type: "TOGGLE_AI", payload: open })}
          >
            <Separator orientation="vertical" />
            <NodeSelector
              open={openNode}
              onOpenChange={(open) => dispatch({ type: "TOGGLE_NODE", payload: open })}
            />

            <Separator orientation="vertical" />
            <LinkSelector
              open={openLink}
              onOpenChange={(open) => dispatch({ type: "TOGGLE_LINK", payload: open })}
            />

            <Separator orientation="vertical" />
            <TextButtons />
          </EditorMenu>
        </EditorContent>
      </EditorRoot>
    </div>
  );
}
