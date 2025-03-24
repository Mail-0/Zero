import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { generateAIEmailContent } from '@/actions/ai';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';

function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func.apply(null, args);
      timeout = null;
    }, wait);
  };
}

export interface ThreadContext {
  subject?: string;
  previousEmails?: Array<{
    content: string;
    sender: string;
    timestamp: string;
  }>;
}

export interface GhostTextOptions {
  threadContext?: ThreadContext;
}

interface GhostTextStorage {
  suggestion: string | null;
  loading: boolean;
  threadContext?: ThreadContext;
}

export const GhostText = Extension.create<GhostTextOptions>({
  name: 'ghostText',

  addStorage() {
    return {
      suggestion: null,
      loading: false,
      threadContext: this.options.threadContext,
    };
  },

  onUpdate() {
    const storage = this.storage as GhostTextStorage;
    storage.threadContext = this.options.threadContext;
  },

  addProseMirrorPlugins() {
    const key = new PluginKey('ghostText');
    const storage = this.storage as GhostTextStorage;

    const hasSignoff = (text: string): boolean => {
      const signoffs = [
        /best regards/i,
        /regards/i,
        /sincerely/i,
        /cheers/i,
        /thanks/i,
        /thank you/i,
        /yours truly/i,
        /best wishes/i,
        /warm regards/i,
        /kind regards/i,
        /all the best/i,
      ];

      return signoffs.some((signoff) => signoff.test(text));
    };

    const fetchSuggestion = debounce(async (text: string) => {
      if (storage.loading || hasSignoff(text)) return;
      storage.loading = true;

      try {
        const threadContext = storage.threadContext;
        let prompt = '';

        if (threadContext?.previousEmails?.length) {
          prompt = 'Given this email thread:\n';
          if (threadContext.subject) {
            prompt += `Subject: ${threadContext.subject}\n\n`;
          }

          [...threadContext.previousEmails].reverse().forEach((email) => {
            prompt += `From: ${email.sender}\nTime: ${email.timestamp}\nContent:\n${email.content}\n\n`;
          });
          prompt +=
            'Now the user is writing a reply. Based on the thread context and current text, suggest a natural continuation that:\n';
          prompt += '1. Maintains a consistent tone with previous emails\n';
          prompt += '2. Addresses any questions or points raised in the thread\n';
          prompt += '3. Follows the conversation flow naturally\n\n';
        } else {
          prompt =
            'Suggest a natural continuation for this email text that maintains a professional and friendly tone.\n\n';
        }

        prompt += 'Current text to continue:';

        const response = await generateAIEmailContent({
          prompt: prompt + ' ' + text,
          currentContent: text,
          isEdit: false,
        });

        if (response.content && response.content.length > 0) {
          storage.suggestion = response.content;
          // Force a view update to show the new suggestion
          this.editor?.view.dispatch(this.editor.view.state.tr);
        }
      } catch (error) {
        console.error('Error fetching AI suggestion:', error);
        storage.suggestion = null;
      } finally {
        storage.loading = false;
      }
    }, 500);

    return [
      new Plugin({
        key,
        props: {
          decorations: (state) => {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];

            if (
              selection.empty &&
              selection.$head.parentOffset === selection.$head.parent.content.size
            ) {
              const node = selection.$head.parent;
              const text = node.textContent;

              if (text.length > 0 && !storage.loading && !storage.suggestion) {
                fetchSuggestion(text);
              }
              if (storage.suggestion) {
                decorations.push(
                  Decoration.widget(selection.$head.pos, () => {
                    const span = document.createElement('span');
                    span.className = 'ghost-text';
                    span.textContent = storage.suggestion;
                    return span;
                  }),
                );
              }
            }

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const storage = this.storage as GhostTextStorage;

        if (storage.suggestion) {
          editor.commands.insertContent(storage.suggestion);
          storage.suggestion = null;
          return true;
        }

        return false;
      },
    };
  },
});
