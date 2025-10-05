import { Timeline, type HistoryEvent } from '../crm/timeline';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { useEditor, EditorContent } from '@tiptap/react';
import Placeholder from '@tiptap/extension-placeholder';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Button } from '@/components/ui/button';
import StarterKit from '@tiptap/starter-kit';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Extension } from '@tiptap/core';
import { cn } from '@/lib/utils';
import React from 'react';

interface RightSidebarProps {
  children?: React.ReactNode;
  className?: string;
}

// Mock user data - same as onboarding
const mockUserData = {
  name: 'Jesse',
  role: 'Founder & CEO',
  location: 'San Francisco',
  linkedin: 'https://www.linkedin.com/in/jesse-li-6b6465168/',
  company: {
    name: 'Cedar',
    fullName: 'Cedar Technologies',
    product: 'CedarMail - AI-powered email management platform',
    description:
      'Building the future of intelligent email management with AI-powered workflows that automatically categorize, respond to, and manage your inbox.',
    sector: 'Enterprise SaaS / AI Productivity Tools',
    size: '15-20 employees',
    recentNews: [
      {
        type: 'Funding',
        title: 'Cedar Technologies closes $2M seed round',
        summary: 'Led by top-tier VCs to accelerate AI email automation',
        link: 'https://example.com/news/seed-round',
      },
      {
        type: 'New Customer',
        title: 'Partnership with major enterprise clients',
        summary: 'Onboarding Fortune 500 companies for email automation',
        link: 'https://example.com/news/enterprise-partnership',
      },
      {
        type: 'Product Release',
        title: 'Featured in TechCrunch AI50',
        summary: 'Recognition as top AI startup transforming productivity',
        link: 'https://example.com/news/techcrunch-ai50',
      },
    ],
  },
};

// Tiptap extension for template highlighting using decorations
const TemplateHighlight = Extension.create({
  name: 'templateHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('templateHighlight'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const doc = state.doc;

            doc.descendants((node, pos) => {
              if (!node.isText || !node.text) {
                return;
              }

              const text = node.text;

              // Track ranges that are already decorated as mentions to avoid conflicts
              const mentionRanges: Array<{ from: number; to: number }> = [];

              // FIRST: Match @mention patterns (both {@type: content} and @type formats)
              // Pattern matches: {@slack: ops-tools} or @spam
              const mentionRegex = /\{@(\w+):[^}]+\}|@(\w+)\b/g;
              let match;
              while ((match = mentionRegex.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;
                mentionRanges.push({ from, to });

                // Capture group 1 is for {@type: content}, group 2 is for @type
                const mentionType = (match[1] || match[2]).toLowerCase();

                // Determine CSS class based on mention type for dark mode support
                let cssClass = 'template-mention-default';

                if (mentionType === 'slack') {
                  cssClass = 'template-mention-slack';
                } else if (mentionType === 'notion') {
                  cssClass = 'template-mention-notion';
                } else if (mentionType === 'linear') {
                  cssClass = 'template-mention-linear';
                } else if (mentionType === 'calendar') {
                  cssClass = 'template-mention-calendar';
                } else if (mentionType === 'knowledge') {
                  cssClass = 'template-mention-knowledge';
                } else if (mentionType === 'spam') {
                  cssClass = 'template-mention-spam';
                } else if (mentionType === 'archive') {
                  cssClass = 'template-mention-archive';
                } else if (mentionType === 'template') {
                  cssClass = 'template-mention-template';
                }

                decorations.push(
                  Decoration.inline(from, to, {
                    class: `template-mention ${cssClass}`,
                  }),
                );
              }

              // SECOND: Match {variable} patterns, but skip ranges already marked as mentions
              const curlyBraceRegex = /\{[^}]+\}/g;
              while ((match = curlyBraceRegex.exec(text)) !== null) {
                const from = pos + match.index;
                const to = from + match[0].length;

                // Skip if this range overlaps with any mention
                const isOverlappingMention = mentionRanges.some(
                  (range) => from < range.to && to > range.from,
                );

                if (!isOverlappingMention) {
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: 'template-variable',
                      style: `background-color: hsl(var(--primary) / 0.2); color: hsl(var(--primary)); border-radius: 0.25rem; padding: 0 0.25rem;`,
                    }),
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// Helper function to convert plain text with newlines to HTML
function textToHtml(text: string): string {
  if (!text) return '<p></p>';

  // Split by double newlines for paragraphs
  const paragraphs = text.split('\n\n');

  return paragraphs
    .map((para) => {
      // Handle empty paragraphs
      if (para.trim() === '') return '<p></p>';

      // Replace single newlines within paragraphs with <br>
      const content = para.split('\n').join('<br>');
      return `<p>${content}</p>`;
    })
    .join('');
}

// Helper function to convert HTML back to plain text with newlines
function htmlToText(html: string): string {
  // Replace <br> tags with newlines
  let text = html.replace(/<br\s*\/?>/gi, '\n');

  // Replace closing </p> tags with double newlines
  text = text.replace(/<\/p>\s*<p>/gi, '\n\n');

  // Remove any remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');

  return text.trim();
}

// Component for editable template textbox with @ notation highlighting
function EditableTemplateTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Enter text...',
      }),
      TemplateHighlight,
    ],
    content: textToHtml(value),
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-full p-3 text-sm whitespace-pre-wrap overflow-hidden',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plainText = htmlToText(html);
      onChange(plainText);
    },
  });

  // Update editor when value changes externally
  useEffect(() => {
    if (editor) {
      const currentPlainText = htmlToText(editor.getHTML());
      if (currentPlainText !== value) {
        editor.commands.setContent(textToHtml(value));
      }
    }
  }, [value, editor]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <style>{`
        .sidebar-editor .tiptap {
          outline: none;
          width: 100%;
          word-wrap: break-word;
          overflow-wrap: break-word;
          white-space: pre-wrap;
        }
        
        .sidebar-editor .tiptap p {
          margin: 0.25rem 0;
          line-height: 1.4;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .sidebar-editor .tiptap p:first-child {
          margin-top: 0;
        }
        .sidebar-editor .tiptap p:last-child {
          margin-bottom: 0;
        }
        .sidebar-editor .tiptap p.is-editor-empty:first-child::before {
          color: hsl(var(--muted-foreground) / 0.5);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        /* Template variable styling */
        .sidebar-editor .template-variable {
          background-color: hsl(var(--primary) / 0.2);
          color: hsl(var(--primary));
          border-radius: 0.25rem;
          padding: 0 0.25rem;
          word-break: break-all;
        }
        
        /* Base mention styling */
        .sidebar-editor .template-mention {
          border-radius: 0.25rem;
          padding: 0 0.25rem;
          font-weight: 500;
          word-break: break-all;
        }
        
        /* Mention type colors - light mode */
        .sidebar-editor .template-mention-default { background-color: rgb(224 242 254); color: rgb(3 105 161); }
        .sidebar-editor .template-mention-slack { background-color: rgb(251 207 232); color: rgb(190 24 93); }
        .sidebar-editor .template-mention-notion { background-color: rgb(243 244 246); color: rgb(55 65 81); }
        .sidebar-editor .template-mention-linear { background-color: rgb(237 233 254); color: rgb(109 40 217); }
        .sidebar-editor .template-mention-calendar { background-color: rgb(219 234 254); color: rgb(29 78 216); }
        .sidebar-editor .template-mention-knowledge { background-color: rgb(209 250 229); color: rgb(4 120 87); }
        .sidebar-editor .template-mention-spam { background-color: rgb(254 226 226); color: rgb(185 28 28); }
        .sidebar-editor .template-mention-archive { background-color: rgb(254 243 199); color: rgb(180 83 9); }
        .sidebar-editor .template-mention-template { background-color: rgb(207 250 254); color: rgb(14 116 144); }
        
        /* Mention type colors - dark mode */
        .dark .sidebar-editor .template-mention-default { background-color: rgb(7 89 133 / 0.3); color: rgb(125 211 252); }
        .dark .sidebar-editor .template-mention-slack { background-color: rgb(131 24 67 / 0.3); color: rgb(244 114 182); }
        .dark .sidebar-editor .template-mention-notion { background-color: rgb(31 41 55 / 0.3); color: rgb(209 213 219); }
        .dark .sidebar-editor .template-mention-linear { background-color: rgb(76 29 149 / 0.3); color: rgb(196 181 253); }
        .dark .sidebar-editor .template-mention-calendar { background-color: rgb(30 64 175 / 0.3); color: rgb(147 197 253); }
        .dark .sidebar-editor .template-mention-knowledge { background-color: rgb(6 78 59 / 0.3); color: rgb(110 231 183); }
        .dark .sidebar-editor .template-mention-spam { background-color: rgb(127 29 29 / 0.3); color: rgb(252 165 165); }
        .dark .sidebar-editor .template-mention-archive { background-color: rgb(120 53 15 / 0.3); color: rgb(253 230 138); }
        .dark .sidebar-editor .template-mention-template { background-color: rgb(21 94 117 / 0.3); color: rgb(103 232 249); }
      `}</style>
      <EditorContent
        editor={editor}
        className="bg-background focus-within:ring-primary sidebar-editor min-h-0 flex-1 overflow-y-auto rounded border focus-within:ring-2"
      />
    </div>
  );
}

function EmailDetailsContent() {
  const [objectiveText, setObjectiveText] = useState(
    'Close deal with {@knowledge base: customer name} by {@calendar: end of quarter}',
  );
  const [nextStepText, setNextStepText] = useState('Follow up with @template on Oct 3rd');
  const [timelineEvents, setTimelineEvents] = useState<HistoryEvent[]>([
    {
      id: '1',
      type: 'inbound_email',
      title: 'Initial inquiry received',
      date: '2024-10-01',
      description: 'Customer expressed interest in our enterprise solution',
    },
    {
      id: '2',
      type: 'outbound_email',
      title: 'Sent product demo',
      date: '2024-10-02',
      description: 'Shared comprehensive demo video and pricing information',
    },
    {
      id: '3',
      type: 'meeting',
      title: 'Discovery call scheduled',
      date: '2024-10-05',
      description: 'Scheduled for tomorrow at 2 PM PST',
    },
  ]);

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Profile Section */}
      <div className="bg-muted/50 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Profile</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm">
              <span className="text-primary font-medium">{mockUserData.role}</span> @{' '}
              <span className="text-accent-foreground font-medium">
                {mockUserData.company.name}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <svg
                className="text-muted-foreground h-3 w-3"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
              <span className="text-muted-foreground text-xs">{mockUserData.location}</span>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium">{mockUserData.company.fullName}</h4>
            <p className="text-muted-foreground text-xs">{mockUserData.company.sector}</p>
            <p className="text-muted-foreground text-xs">{mockUserData.company.size}</p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium">Recent News</p>
            <div className="space-y-1">
              {mockUserData.company.recentNews.slice(0, 2).map((news) => (
                <div
                  key={news.link}
                  className="bg-background/50 hover:bg-muted/50 cursor-pointer rounded border p-2 transition-colors"
                >
                  <div className="mb-1 flex items-center gap-1">
                    <span className="bg-primary/10 text-primary rounded px-1 py-0.5 text-xs font-medium">
                      {news.type}
                    </span>
                  </div>
                  <p className="text-xs font-medium">{news.title}</p>
                  <p className="text-muted-foreground text-xs">{news.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Objective Section */}
      <div className="bg-muted/50 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Objective</h3>
        <EditableTemplateTextarea
          value={objectiveText}
          onChange={setObjectiveText}
          placeholder="Enter objective with @mentions..."
          className="min-h-[60px]"
        />
      </div>

      {/* Current AOP Section */}
      <div className="bg-muted/50 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Current AOP</h3>
        <Button variant="outline" className="w-full">
          View Action Plan
        </Button>
      </div>

      {/* Default Next Steps Section */}
      <div className="bg-muted/50 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Follow up instructions</h3>
        <EditableTemplateTextarea
          value={nextStepText}
          onChange={setNextStepText}
          placeholder="Enter next steps with @mentions..."
          className="min-h-[60px]"
        />
      </div>

      {/* Timeline Section */}
      <div className="bg-muted/50 rounded-lg border p-4">
        <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
        <Timeline events={timelineEvents} onChange={setTimelineEvents} />
      </div>
    </div>
  );
}

export function RightSidebar({ children, className }: RightSidebarProps) {
  const params = useParams<{ threadId?: string }>();
  const hasOpenEmail = !!params?.threadId;

  return (
    <div
      className={cn(
        'bg-sidebar dark:bg-sidebar flex h-screen w-80 flex-col border-l border-gray-200 dark:border-gray-800',
        className,
      )}
    >
      <div className="flex-1 p-4">
        {hasOpenEmail ? (
          <EmailDetailsContent />
        ) : (
          children || (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              <p className="text-sm">Right sidebar content</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
