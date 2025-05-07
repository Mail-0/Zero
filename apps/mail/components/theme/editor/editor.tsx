'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useThemePresetStore } from '@/store/theme-preset-store';
import type { Theme, ThemeStyles } from '@/types/theme';
import { useEditorStore } from '@/store/editor-store';
import type { ThemeEditorState } from '@zero/mail/types/editor';
import { ActionBar } from './action-bar/action-bar';
import { type EditorConfig } from '@/types/editor';
import { authClient } from '@/lib/auth-client';
import React, { useEffect, use } from 'react';
import { Sliders } from 'lucide-react';

interface EditorProps {
  config: EditorConfig;
  themePromise: Promise<Theme | null>;
}

const isThemeStyles = (styles: unknown): styles is ThemeStyles => {
  return (
    !!styles &&
    typeof styles === 'object' &&
    styles !== null &&
    'light' in styles &&
    'dark' in styles
  );
};

const Editor: React.FC<EditorProps> = ({ config, themePromise }) => {
  const themeState = useEditorStore((state) => state.themeState);
  const setThemeState = useEditorStore((state) => state.setThemeState);
  const saveThemeCheckpoint = useEditorStore((state) => state.saveThemeCheckpoint);
  const Controls = config.controls;

  const loadSavedPresets = useThemePresetStore((state) => state.loadSavedPresets);

  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user) {
      // loadSavedPresets();
    }
  }, [loadSavedPresets, session?.user]);

  const initialTheme = null;

  const handleStyleChange = React.useCallback(
    (newStyles: ThemeStyles) => {
      console.log('newStyles', newStyles);
      const prev = useEditorStore.getState().themeState;
      setThemeState({ ...prev, styles: newStyles });
    },
    [setThemeState],
  );

  useEffect(() => {
    if (initialTheme && isThemeStyles(initialTheme.styles)) {
      const prev = useEditorStore.getState().themeState;
      setThemeState({ ...prev, styles: initialTheme.styles });
      saveThemeCheckpoint();
    }
  }, [initialTheme, setThemeState, saveThemeCheckpoint]);

  if (initialTheme && !isThemeStyles(initialTheme.styles)) {
    return (
      <div className="text-destructive flex h-full items-center justify-center">
        Fetched theme data is invalid.
      </div>
    );
  }

  const styles = themeState.styles;

  return (
    <div className="h-full overflow-hidden">
      {/* Desktop Layout */}
      <div className="hidden h-full md:block">
        <div className="flex h-full flex-col">
          {/* <p className='text-[4px]'>

          {JSON.stringify(themeState)}
          </p> */}
          <Controls
            // @ts-ignore
            styles={styles}
            onChange={handleStyleChange}
            currentMode={themeState.currentMode}
            themePromise={themePromise}
          />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="h-full md:hidden">
        <Tabs defaultValue="controls" className="h-full">
          <TabsList className="w-full rounded-none">
            <TabsTrigger value="controls" className="flex-1">
              <Sliders className="mr-2 h-4 w-4" />
              Controls
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1">
              Preview
            </TabsTrigger>
          </TabsList>
          <TabsContent value="controls" className="mt-0 h-[calc(100%-2.5rem)]">
            <div className="flex h-full flex-col">
              <Controls
                // @ts-ignore
                styles={styles}
                onChange={handleStyleChange}
                currentMode={themeState.currentMode}
                themePromise={themePromise}
              />
            </div>
          </TabsContent>
          <TabsContent value="preview" className="mt-0 h-[calc(100%-2.5rem)]">
            <div className="flex h-full flex-col">
              <ActionBar />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const MemoizedEditor = React.memo(Editor);

export default MemoizedEditor;
