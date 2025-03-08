"use client";

import {
  Bold,
  Italic,
  Strikethrough,
  Underline,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react";
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  type JSONContent,
} from "novel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TextButtons } from "@/components/create/selectors/text-buttons";
import { suggestionItems } from "@/components/create/slash-command";
import { defaultExtensions } from "@/components/create/extensions";
import { ImageResizer, handleCommandNavigation } from "novel";
import { uploadFn } from "@/components/create/image-upload";
import { handleImageDrop, handleImagePaste } from "novel";
import EditorMenu from "@/components/create/editor-menu";
import { Button } from "@/components/ui/button";
import { useCurrentEditor } from "@tiptap/react";
import { Input } from "@/components/ui/input";
import { useReducer, useRef } from "react";
import { useState } from "react";

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

// Update the MenuBar component with icons
const MenuBar = () => {
  const { editor } = useCurrentEditor();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  if (!editor) {
    return null;
  }

  // Replace the old setLink function with this new implementation
  const handleLinkDialogOpen = () => {
    // If a link is already active, pre-fill the input with the current URL
    if (editor.isActive("link")) {
      const attrs = editor.getAttributes("link");
      setLinkUrl(attrs.href || "");
    } else {
      setLinkUrl("");
    }
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    // empty
    if (linkUrl === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      // Format the URL with proper protocol if missing
      let formattedUrl = linkUrl;
      if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = `https://${formattedUrl}`;
      }
      // set link
      editor.chain().focus().setLink({ href: formattedUrl }).run();
    }
    setLinkDialogOpen(false);
  };

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkDialogOpen(false);
  };

  return (
    <>
      <div className="control-group mb-2 overflow-x-auto">
        <div className="button-group ml-2 mt-1 flex flex-wrap gap-1 border-b pb-2">
          <div className="mr-2 flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("heading", { level: 1 }) ? "bg-muted" : "bg-background"}`}
              title="Heading 1"
            >
              <Heading1 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("heading", { level: 2 }) ? "bg-muted" : "bg-background"}`}
              title="Heading 2"
            >
              <Heading2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("heading", { level: 3 }) ? "bg-muted" : "bg-background"}`}
              title="Heading 3"
            >
              <Heading3 className="h-4 w-4" />
            </button>
          </div>

          <div className="mr-2 flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("bold") ? "bg-muted" : "bg-background"}`}
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("italic") ? "bg-muted" : "bg-background"}`}
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().focus().toggleStrike().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("strike") ? "bg-muted" : "bg-background"}`}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("underline") ? "bg-muted" : "bg-background"}`}
              title="Underline"
            >
              <Underline className="h-4 w-4" />
            </button>
            <button
              onClick={handleLinkDialogOpen}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("link") ? "bg-muted" : "bg-background"}`}
              title="Link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("bulletList") ? "bg-muted" : "bg-background"}`}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`hover:bg-muted rounded p-1.5 ${editor.isActive("orderedList") ? "bg-muted" : "bg-background"}`}
              title="Ordered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
            <DialogDescription>
              Add a URL to create a link. The link will open in a new tab.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="url" className="text-sm font-medium">
                URL
              </label>
              <Input
                id="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" onClick={handleRemoveLink} type="button">
              Cancel
            </Button>
            <Button onClick={handleSaveLink} type="button">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default function Editor({
  initialValue,
  onChange,
  placeholder = "Write something...",
}: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, {
    openNode: false,
    openColor: false,
    openLink: false,
    openAI: false,
  });

  // Add a ref to store the editor content to prevent losing it on refresh
  const contentRef = useRef<string>("");
  // Add a ref to the editor instance
  const editorRef = useRef<any>(null);

  const { openNode, openColor, openLink, openAI } = state;

  // Function to focus the editor
  const focusEditor = () => {
    if (editorRef.current) {
      editorRef.current.commands.focus();
    }
  };

  return (
    <div
      className="relative w-full max-w-[450px] sm:max-w-[600px]"
      onClick={focusEditor} // Add click handler to focus the editor
      onKeyDown={(e) => {
        // Prevent form submission on Enter key
        if (e.key === "Enter" && !e.shiftKey) {
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
            // Store the editor instance in the ref
            editorRef.current = editor;
            onChange(editor.getHTML());
          }}
          slotBefore={<MenuBar />}
          slotAfter={<ImageResizer />}
        >
          {/* Make sure the command palette doesn't cause a refresh */}
          <EditorCommand
            className="border-muted bg-background z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border px-1 py-2 shadow-md transition-all"
            onKeyDown={(e) => {
              // Prevent form submission on any key that might trigger it
              if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
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

          {/* Replace the default editor menu with just our TextButtons */}
          <EditorMenu
            open={openAI}
            onOpenChange={(open) => dispatch({ type: "TOGGLE_AI", payload: open })}
          >
            <TextButtons />
          </EditorMenu>
        </EditorContent>
      </EditorRoot>
    </div>
  );
}
