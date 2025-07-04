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
  Paperclip,
  Plus,
} from 'lucide-react';
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  EditorRoot,
  useEditor,
  type JSONContent,
} from 'novel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEditor as useEditorContext } from '@/components/providers/editor-provider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Editor as TiptapEditor, useCurrentEditor } from '@tiptap/react';
import { suggestionItems } from '@/components/create/slash-command';
import { defaultExtensions } from '@/components/create/extensions';
import { ImageResizer, handleCommandNavigation } from 'novel';
import { handleImageDrop, handleImagePaste } from 'novel';
import EditorMenu from '@/components/create/editor-menu';
import { UploadedFileIcon } from './uploaded-file-icon';
import { Separator } from '@/components/ui/separator';
import { useReducer, useRef, useEffect } from 'react';
import { AutoComplete } from './editor-autocomplete';
import { Editor as CoreEditor } from '@tiptap/core';
import { cn, truncateFileName } from '@/lib/utils';
import { TextSelection } from 'prosemirror-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EditorView } from 'prosemirror-view';
import { Markdown } from 'tiptap-markdown';
import { Slice } from 'prosemirror-model';
import { m } from '@/paraglide/messages';
import { useState } from 'react';
import React from 'react';

export const defaultEditorContent = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
};

interface EditorProps {
  initialValue?: JSONContent;
  onChange: (content: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  onCommandEnter?: () => void;
  onAttachmentsChange?: (attachments: File[]) => void;
  myInfo?: {
    name?: string;
    email?: string;
  };
  senderInfo?: {
    name?: string;
    email?: string;
  };
  onTab?: () => boolean;
  onEditorReady?: (editor: TiptapEditor) => void;
  includeSignature?: boolean;
  onSignatureToggle?: (include: boolean) => void;
  signature?: string;
  hasSignature?: boolean;
  readOnly?: boolean;
  hideToolbar?: boolean;
}

interface EditorState {
  openNode: boolean;
  openColor: boolean;
  openLink: boolean;
  openAI: boolean;
}

type EditorAction =
  | { type: 'TOGGLE_NODE'; payload: boolean }
  | { type: 'TOGGLE_COLOR'; payload: boolean }
  | { type: 'TOGGLE_LINK'; payload: boolean }
  | { type: 'TOGGLE_AI'; payload: boolean };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'TOGGLE_NODE':
      return { ...state, openNode: action.payload };
    case 'TOGGLE_COLOR':
      return { ...state, openColor: action.payload };
    case 'TOGGLE_LINK':
      return { ...state, openLink: action.payload };
    case 'TOGGLE_AI':
      return { ...state, openAI: action.payload };
    default:
      return state;
  }
}

// Update the MenuBar component with icons
interface MenuBarProps {
  onAttachmentsChange?: (attachments: File[]) => void;
  includeSignature?: boolean;
  onSignatureToggle?: (include: boolean) => void;
  hasSignature?: boolean;
}

const MenuBar = () => {
  const { editor } = useCurrentEditor();

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) {
    return null;
  }

  // Replace the old setLink function with this new implementation
  const handleLinkDialogOpen = () => {
    // If a link is already active, pre-fill the input with the current URL
    if (editor.isActive('link')) {
      const attrs = editor.getAttributes('link');
      setLinkUrl(attrs.href || '');
    } else {
      setLinkUrl('');
    }
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    // empty
    if (linkUrl === '') {
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
      <TooltipProvider>
        <div className="control-group mb-2 overflow-x-auto">
          <div className="button-group ml-0 mt-1 flex flex-wrap gap-1 border-b pb-2">
            <div className="mr-2 flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('bold') ? 'bg-muted' : 'bg-background'}`}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.bold()}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('italic') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.italic()}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    disabled={!editor.can().chain().focus().toggleStrike().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('strike') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <Strikethrough className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {m.pages.createEmail.editor.menuBar.strikethrough()}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('underline') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <Underline className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.underline()}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={handleLinkDialogOpen}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('link') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.link()}</TooltipContent>
              </Tooltip>
            </div>

            <Separator orientation="vertical" className="relative right-1 top-0.5 h-6" />

            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('bulletList') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.bulletList()}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`h-auto w-auto rounded p-1.5 ${editor.isActive('orderedList') ? 'bg-muted' : 'bg-background'}`}
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{m.pages.createEmail.editor.menuBar.orderedList()}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </TooltipProvider>

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{m.pages.createEmail.addLink()}</DialogTitle>
            <DialogDescription>{m.pages.createEmail.addUrlToCreateALink()}</DialogDescription>
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
              {m.common.actions.cancel()}
            </Button>
            <Button onClick={handleSaveLink} type="button">
              {m.common.actions.save()}
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
  placeholder = 'Start your email here',
  onFocus,
  onBlur,
  className,
  onCommandEnter,
  onTab,
  onAttachmentsChange,
  senderInfo,
  myInfo,
  readOnly,
  hideToolbar,
}: EditorProps) {
  const [state, dispatch] = useReducer(editorReducer, {
    openNode: false,
    openColor: false,
    openLink: false,
    openAI: false,
  });

  const contentRef = useRef<string>('');
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { openNode, openColor, openLink, openAI } = state;

  // Function to focus the editor
  const focusEditor = () => {
    if (editor && !readOnly) {
      editor.commands.focus('end');
    }
  };

  // Function to clear editor content
  const clearEditorContent = React.useCallback(() => {
    if (editor) {
      editor.commands.clearContent(true);
      // Also update our reference and notify parent
      contentRef.current = '';
      onChange('');
    }
  }, [editor, onChange]);

  // Reset editor content when initialValue changes
  React.useEffect(() => {
    // We need to make sure both the editor reference exists AND initialValue is provided
    if (editor && initialValue) {
      try {
        // Make sure the editor is ready before setting content
        setTimeout(() => {
          // Double-check that the editor still exists in case of unmounting
          if (editor?.commands?.setContent) {
            editor.commands.setContent(initialValue);

            // Important: after setting content, manually trigger an update
            // to ensure the parent component gets the latest content
            const html = editor.getHTML();
            contentRef.current = html;
            onChange(html);
          }
        }, 0);
      } catch (error) {
        console.error('Error setting editor content:', error);
      }
    }
  }, [initialValue, editor, onChange]);

  // Handle command+enter or ctrl+enter
  const handleCommandEnter = React.useCallback(() => {
    // Call the parent's onCommandEnter
    onCommandEnter?.();

    // Clear the editor content after sending
    setTimeout(() => {
      if (editor?.commands?.clearContent) {
        clearEditorContent();
      }
    }, 200);
  }, [onCommandEnter, clearEditorContent, editor]);

  return (
    <div
      className={`relative w-full ${className || ''}`}
      onClick={focusEditor}
      onKeyDown={(e) => {
        if (readOnly) return;
        // Handle tab key
        if (e.key === 'Tab' && !e.shiftKey) {
          if (onTab && onTab()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
          e.stopPropagation();
        }

        // Handle Command+Enter (Mac) or Ctrl+Enter (Windows/Linux)
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          handleCommandEnter();
        }
      }}
    >
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          initialContent={initialValue || defaultEditorContent}
          extensions={[
            ...defaultExtensions,
            Markdown,
            AutoComplete.configure({
              suggestions: {
                openers: [
                  'Hi there,',
                  'Hello,',
                  'Dear',
                  'Greetings,',
                  'Good morning,',
                  'Good afternoon,',
                  'Good evening,',
                ],
                closers: [
                  'Best regards,',
                  'Kind regards,',
                  'Sincerely,',
                  'Thanks,',
                  'Thank you,',
                  'Cheers,',
                ],
                custom: [
                  'I hope this email finds you well.',
                  'I look forward to hearing from you.',
                  'Please let me know if you have any questions.',
                ],
              },
              sender: senderInfo,
              myInfo: myInfo,
            }),
          ]}
          ref={containerRef}
          className="no-scrollbar relative max-h-[500px] min-h-[220px] cursor-text overflow-auto"
          editorProps={{
            editable: () => !readOnly,
            handleDOMEvents: {
              mousedown: (view, event) => {
                if (readOnly) return false;
                focusEditor();
                const coords = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (coords) {
                  const pos = coords.pos;
                  const tr = view.state.tr;
                  const selection = TextSelection.create(view.state.doc, pos);
                  tr.setSelection(selection);
                  view.dispatch(tr);
                }

                // Let the default handler also run
                return false;
              },
              keydown: (view, event) => {
                if (readOnly) return false;
                if (event.key === 'Tab' && !event.shiftKey) {
                  if (onTab && onTab()) {
                    event.preventDefault();
                    return true;
                  }
                }

                // Prevent Command+Enter from adding a new line
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  return true;
                }

                return handleCommandNavigation(event);
              },
              focus: () => {
                if (!readOnly) onFocus?.();
                return false;
              },
              blur: () => {
                if (!readOnly) onBlur?.();
                return false;
              },
            },
            handleDrop: (view, event, _slice, moved) => {
              if (readOnly) return false;
              return handleImageDrop(view, event, moved, (file) => {
                onAttachmentsChange?.([file]);
              });
            },
            attributes: {
              class: cn(
                'prose dark:prose-invert prose-headings:font-title focus:outline-none max-w-full min-h-[200px]',
                readOnly && 'pointer-events-none select-text',
              ),
              'data-placeholder': placeholder,
            },
          }}
          onCreate={({ editor: ed }) => {
            setEditor(ed);
          }}
          onDestroy={() => {
            setEditor(null);
          }}
          onUpdate={({ editor: ed }) => {
            if (readOnly) return;
            // Store the content in the ref to prevent losing it
            contentRef.current = ed.getHTML();
            onChange(ed.getHTML());
          }}
          slotAfter={null}
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

          {/* Replace the default editor menu with just our TextButtons */}
          <EditorMenu
            open={openAI}
            onOpenChange={(open) => dispatch({ type: 'TOGGLE_AI', payload: open })}
          >
            {/* Empty children to satisfy the type requirement */}
            <div></div>
          </EditorMenu>
        </EditorContent>
      </EditorRoot>
    </div>
  );
}
