import { createContext, useContext, useState } from 'react';
import { Editor } from '@tiptap/react';

interface EditorContextType {
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
}

export const EditorContext = createContext<EditorContextType>({
  editor: null,
  setEditor: () => {},
});

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null);

  return <EditorContext.Provider value={{ editor, setEditor }}>{children}</EditorContext.Provider>;
}

export function useEditor() {
  return useContext(EditorContext);
}
