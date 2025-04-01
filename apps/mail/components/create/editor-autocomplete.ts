import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { emailPhrases } from './email-phrases';
import { EditorView } from '@tiptap/pm/view';
import { Extension } from '@tiptap/core';
import './ghost-text.css';

export interface SenderInfo {
  name?: string;
  email?: string;
}

export interface EmailSuggestions {
  openers?: string[];
  closers?: string[];
  custom?: string[];
  commonPhrases?: string[];
  timeBased?: string[];
  contextBased?: string[];
}

export interface AutoCompleteOptions {
  suggestions: EmailSuggestions;
  sender?: SenderInfo;
  myInfo?: SenderInfo;
  context?: {
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    dayOfWeek?: string;
    previousEmails?: string[];
  };
  editor?: EditorView;
}

export const AutoComplete = Extension.create<AutoCompleteOptions>({
  name: 'ghostText',

  addProseMirrorPlugins() {
    const key = new PluginKey('ghostText');
    const options = this.options;

    const usedSuggestions = new Set<string>();

    const findMatchingSuggestions = (currentText: string, opts: AutoCompleteOptions) => {
      if (!currentText) return [];

      const doc = opts.editor?.state.doc;
      const fullText = doc ? doc.textContent : '';

      opts.suggestions = opts.suggestions || {};

      const timeOfDay = opts.context?.timeOfDay;
      if (timeOfDay && opts.sender?.name) {
        const { name } = opts.sender;
        opts.suggestions.timeBased = [
          `Good ${timeOfDay} ${name},`,
          `I hope you're having a good ${timeOfDay} ${name},`,
          `Wishing you a wonderful ${timeOfDay} ${name},`,
        ];
      }

      if (opts.context?.previousEmails?.length) {
        const lastEmail = opts.context.previousEmails[opts.context.previousEmails.length - 1];
        opts.suggestions.contextBased = opts.suggestions.contextBased || [];
        opts.suggestions.contextBased.push(
          `Thank you for your email regarding ${lastEmail}.`,
          `I received your message about ${lastEmail}.`,
          `I understand your point about ${lastEmail}.`,
        );
      }

      opts.suggestions.commonPhrases = [
        ...emailPhrases.custom,
        `I hope this email finds you well.`,
        `I wanted to follow up on our previous conversation.`,
        `I'm writing to discuss...`,
        `I would like to schedule a meeting to discuss...`,
        `Please let me know if you have any questions.`,
        `I look forward to your response.`,
        `I appreciate your time and consideration.`,
        `I'm happy to help with anything else you need.`,
        `Please don't hesitate to reach out if you need any clarification.`,
        `I'll be in touch soon.`,
      ];

      if (opts.sender) {
        const { name } = opts.sender;
        if (name) {
          const customizedOpeners = emailPhrases.openers.map((opener) =>
            opener.replace('{name}', name),
          );
          opts.suggestions.openers = [
            ...customizedOpeners,
            `I hope you're doing well ${name},`,
            `I trust this email finds you well ${name},`,
            `I hope you're having a great day ${name},`,
          ];
        }
      }

      if (opts.myInfo) {
        const { name } = opts.myInfo;
        if (name) {
          opts.suggestions.closers?.push(
            `Best regards,\n${name}`,
            `Kind regards,\n${name}`,
            `Sincerely,\n${name}`,
            `Thanks,\n${name}`,
            `Best wishes,\n${name}`,
            `Warm regards,\n${name}`,
            `Cheers,\n${name}`,
            `Take care,\n${name}`,
            `Looking forward to your response,\n${name}`,
            `I look forward to hearing from you,\n${name}`,
          );
        }
      }

      const allSuggestions = [
        ...(opts.suggestions?.openers || []),
        ...(opts.suggestions?.closers || []),
        ...(opts.suggestions?.custom || []),
        ...(opts.suggestions?.commonPhrases || []),
        ...(opts.suggestions?.timeBased || []),
        ...(opts.suggestions?.contextBased || []),
      ].filter(Boolean);

      return allSuggestions
        .filter((suggestion) => {
          const suggestionStart = suggestion.toLowerCase().slice(0, 2);
          const textStart = currentText.toLowerCase().slice(0, 2);
          const matchesCurrentText =
            suggestionStart === textStart &&
            suggestion.toLowerCase().startsWith(currentText.toLowerCase()) &&
            suggestion.length > currentText.length;

          const isAlreadyUsed = usedSuggestions.has(suggestion);

          const isSimilarGreetingUsed = fullText.includes(suggestion?.split(',')[0] || '');

          const isInMiddleOfEmail = fullText.length > 100;

          return (
            matchesCurrentText &&
            !isAlreadyUsed &&
            (!isInMiddleOfEmail ||
              (!suggestion.includes('Hello') &&
                !suggestion.includes('Hi') &&
                !suggestion.includes('Dear'))) &&
            !isSimilarGreetingUsed
          );
        })
        .sort((a, b) => {
          const aExactMatch = a.toLowerCase().startsWith(currentText.toLowerCase());
          const bExactMatch = b.toLowerCase().startsWith(currentText.toLowerCase());
          if (aExactMatch && !bExactMatch) return -1;
          if (!aExactMatch && bExactMatch) return 1;

          return a.length - b.length;
        });
    };

    return [
      new Plugin({
        key,
        props: {
          handleKeyDown(view, event) {
            if (event.key !== 'Tab') return false;

            const { state } = view;
            const { selection } = state;
            if (!(selection instanceof TextSelection) || !selection.$cursor) {
              return false;
            }

            const pos = selection.$cursor.pos;
            const lineStart = state.doc.resolve(pos).start();
            const currentLine = state.doc.textBetween(lineStart, pos, '\n', '\0');

            if (!currentLine) return false;

            const suggestions = findMatchingSuggestions(currentLine, {
              ...options,
              editor: view,
            });

            if (!suggestions.length) return false;

            const suggestion = suggestions[0];
            if (!suggestion) return false;

            const remainingText = suggestion.slice(currentLine.length);
            if (!remainingText) return false;

            event.preventDefault();

            try {
              const tr = state.tr;

              tr.insertText(remainingText, pos);

              view.dispatch(tr);

              usedSuggestions.add(suggestion);

              return true;
            } catch (error) {
              console.error('Error applying suggestion:', error);
              return false;
            }

            return true;
          },
          // @ts-expect-error: tiptap types are not compatible with prosemirror
          decorations: (state, view) => {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];

            if (!(selection instanceof TextSelection) || !selection.$cursor) {
              return DecorationSet.empty;
            }

            const pos = selection.$cursor.pos;
            const lineStart = doc.resolve(pos).start();
            const currentLine = doc.textBetween(lineStart, pos, '\n', '\0');

            if (!currentLine) return DecorationSet.empty;

            const suggestions = findMatchingSuggestions(currentLine, {
              ...options,
              editor: view,
            });

            if (!suggestions.length) return DecorationSet.empty;

            const suggestion = suggestions[0];
            if (!suggestion) return DecorationSet.empty;

            const remainingText = suggestion.slice(currentLine.length);
            if (!remainingText) return DecorationSet.empty;

            const decoration = Decoration.widget(pos, () => {
              const span = document.createElement('span');
              span.textContent = remainingText;
              span.className = 'ghost-text-suggestion';
              return span;
            });

            decorations.push(decoration);
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
