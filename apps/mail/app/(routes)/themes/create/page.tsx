import { ResizableHandle, ResizablePanel } from '@/components/ui/resizable';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CreateThemeFormProvider } from '@/components/theme/create-theme-form-provider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemeFieldRenderer } from '@/components/theme/theme-field-renderer';
import { themeEditorControlConfig } from '@/components/theme/theme-config';
import { ThemePreview } from '@/components/theme/theme-preview';
import { ResizablePanelGroup } from '@/components/ui/resizable';
import { ActionBar } from '@/components/theme/actionbar';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function CreateThemePage() {
  return (
    <CreateThemeFormProvider>
      <div className="w-screen">
        <div className="hidden h-full md:block">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={20} minSize={20} maxSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex min-h-0 flex-1 flex-col space-y-4">
                  <Tabs defaultValue="colors" className="flex min-h-0 w-full flex-1 flex-col">
                    <TabsList>
                      {Object.keys(themeEditorControlConfig).map((key) => (
                        <TabsTrigger key={key} value={key}>
                          {key}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <ScrollArea className="h-full flex-1 p-4 pt-0">
                      {Object.keys(themeEditorControlConfig).map((key) => (
                        <TabsContent key={key} value={key}>
                          <Accordion type="multiple">
                            {themeEditorControlConfig[
                              key as keyof typeof themeEditorControlConfig
                            ].map((section) => (
                              <AccordionItem key={section.id} value={section.id}>
                                <AccordionTrigger>{section.label}</AccordionTrigger>
                                <AccordionContent>
                                  {section.controls.map((control) => (
                                    <ThemeFieldRenderer
                                      key={control.name}
                                      type={control.type}
                                      label={control.label}
                                      name={control.name}
                                      sliderConfig={control.sliderConfig}
                                    />
                                  ))}
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </TabsContent>
                      ))}
                    </ScrollArea>
                  </Tabs>
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={70} minSize={20}>
              <div className="flex h-full flex-col">
                <div className="flex min-h-0 flex-1 flex-col">
                  <ActionBar />
                  <ThemePreview />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </CreateThemeFormProvider>
  );
}
