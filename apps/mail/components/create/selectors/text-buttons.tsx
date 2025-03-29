<<<<<<< HEAD
import {
  BoldIcon,
  CodeIcon,
  ItalicIcon,
  SparkleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from "lucide-react";
import { useAIInline } from "@/components/ui/ai-inline";
import type { SelectorItem } from "./node-selector";
import { EditorBubbleItem, useEditor } from "novel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const TextButtons = () => {
  const { editor } = useEditor();
  const { toggleOpen, setPosition, setEditor } = useAIInline();

  if (!editor) return null;
  const items: SelectorItem[] = [
    {
      name: "bold",
      isActive: (editor) => (editor ? editor.isActive("bold") : false),
      command: (editor) => editor?.chain().focus().toggleBold().run(),
      icon: BoldIcon,
    },
    {
      name: "italic",
      isActive: (editor) => (editor ? editor.isActive("italic") : false),
      command: (editor) => editor?.chain().focus().toggleItalic().run(),
      icon: ItalicIcon,
    },
    {
      name: "underline",
      isActive: (editor) => (editor ? editor.isActive("underline") : false),
      command: (editor) => editor?.chain().focus().toggleUnderline().run(),
      icon: UnderlineIcon,
    },
    {
      name: "strike",
      isActive: (editor) => (editor ? editor.isActive("strike") : false),
      command: (editor) => editor?.chain().focus().toggleStrike().run(),
      icon: StrikethroughIcon,
    },
    {
      name: "code",
      isActive: (editor) => (editor ? editor.isActive("code") : false),
      command: (editor) => editor?.chain().focus().toggleCode().run(),
      icon: CodeIcon,
    },
    {
      name: "AI",
      isActive: () => false,
      command: (editor) => {
        // Get cursor position
        const { view } = editor;
        if (!view) return;

        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);

        setEditor(editor);

        // Set position and open the AI inline component
        setPosition({ x: coords.left, y: coords.top - 150 });
        toggleOpen();
      },
      icon: SparkleIcon,
    },
  ];
=======
import { MessageSquare, FileText, Edit } from 'lucide-react';
import type { SelectorItem } from './node-selector';
import { EditorBubbleItem, useEditor } from 'novel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export const TextButtons = () => {
  const { editor } = useEditor();
  if (!editor) return null;

  // Define AI action handlers
  const handleChatWithAI = () => {
    // Get selected text
    const selection = editor.state.selection;
    const selectedText = selection.empty
      ? ''
      : editor.state.doc.textBetween(selection.from, selection.to);

    console.log('Chat with AI about:', selectedText);
    // Implement chat with AI functionality
  };

  const items = [
    {
      name: 'chat-with-zero',
      label: 'Chat with Zero',
      action: handleChatWithAI,
      useImage: true,
      imageSrc: '/ai.svg',
    },
  ];

>>>>>>> origin/staging
  return (
    <div className="flex">
      {items.map((item) => (
        <EditorBubbleItem
          key={item.name}
<<<<<<< HEAD
          onSelect={(editor) => {
            item.command(editor);
          }}
        >
          <Button size="sm" className="rounded-none" variant="ghost">
            <item.icon
              className={cn("h-4 w-4", {
                "text-blue-500": item.isActive(editor),
              })}
            />
=======
          onSelect={() => {
            item.action();
          }}
        >
          <Button size="sm" className="flex items-center gap-1.5 rounded-none px-3" variant="ghost">
            {item.useImage ? (
              <Image
                src={item.imageSrc}
                alt={item.label}
                width={16}
                height={16}
                className="h-4 w-4"
              />
            ) : (
              <item.icon className="h-4 w-4" />
            )}
            <span className="text-xs">{item.label}</span>
>>>>>>> origin/staging
          </Button>
        </EditorBubbleItem>
      ))}
    </div>
  );
};
