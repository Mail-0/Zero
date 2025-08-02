import { useTemplates } from '@/hooks/use-templates';
import { useTRPC } from '@/providers/query-provider';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Save, Trash2 } from 'lucide-react';
import React, { useState, useMemo, useDeferredValue, useCallback, startTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { TRPCClientError } from '@trpc/client';

type RecipientField = 'to' | 'cc' | 'bcc';

type Template = {
  id: string;
  name: string;
  subject?: string | null;
  body?: string | null;
  to?: string[] | null;
  cc?: string[] | null;
  bcc?: string[] | null;
};

type TemplatesQueryData = {
  templates: Template[];
} | undefined;

interface TemplateButtonProps {
  editor: Editor | null;
  subject: string;
  setSubject: (value: string) => void;
  to: string[];
  cc: string[];
  bcc: string[];
  setRecipients: (field: RecipientField, value: string[]) => void;
}

const TemplateButtonComponent: React.FC<TemplateButtonProps> = ({
  editor,
  subject,
  setSubject,
  to,
  cc,
  bcc,
  setRecipients,
}) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useTemplates();
  
  const templates: Template[] = data?.templates ?? [];

  const [menuOpen, setMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [search, setSearch] = useState('');

  const deferredSearch = useDeferredValue(search);

  const filteredTemplates = useMemo(() => {
    if (!deferredSearch.trim()) return templates;
    return templates.filter((t) =>
      t.name.toLowerCase().includes(deferredSearch.toLowerCase()),
    );
  }, [deferredSearch, templates]);

  const { mutateAsync: createTemplate } = useMutation(trpc.templates.create.mutationOptions());
  const { mutateAsync: deleteTemplateMutation } = useMutation(
    trpc.templates.delete.mutationOptions(),
  );

  const handleSaveTemplate = async () => {
    if (!editor) return;
    if (!templateName.trim()) {
      toast.error('Please provide a name');
      return;
    }

    setIsSaving(true);
    try {
      const newTemplate = await createTemplate({
        name: templateName.trim(),
        subject: subject || '',
        body: editor.getHTML(),
        to: to.length ? to : undefined,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
      });
      queryClient.setQueryData(trpc.templates.list.queryKey(), (old: TemplatesQueryData) => {
        if (!old?.templates) return old;
        return {
          templates: [newTemplate.template, ...old.templates],
        };
      });
      toast.success('Template saved');
      setTemplateName('');
      setSaveDialogOpen(false);
    } catch (error) {
      if (error instanceof TRPCClientError) {
        toast.error(error.message);
      } else {
        toast.error('Failed to save template');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyTemplate = useCallback((template: Template) => {
    if (!editor) return;
    startTransition(() => {
      if (template.subject) setSubject(template.subject);
      if (template.body) editor.commands.setContent(template.body, false);
      if (template.to) setRecipients('to', template.to);
      if (template.cc) setRecipients('cc', template.cc);
      if (template.bcc) setRecipients('bcc', template.bcc);
    });
  }, [editor, setSubject, setRecipients]);

  const handleDeleteTemplate = useCallback(
    async (templateId: string) => {
      try {
        await deleteTemplateMutation({ id: templateId });
        await queryClient.invalidateQueries({
          queryKey: trpc.templates.list.queryKey(),
        });
        toast.success('Template deleted');
      } catch (err) {
        if (err instanceof TRPCClientError) {
          toast.error(err.message);
        } else {
          toast.error('Failed to delete template');
        }
      }
    },
    [deleteTemplateMutation, queryClient, trpc.templates.list],
  );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button size={'xs'} variant={'secondary'} disabled={isSaving}>
            Templates
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-99999 w-60" align="start" sideOffset={6}>
          <DropdownMenuItem
            onSelect={() => {
              setMenuOpen(false);
              setSaveDialogOpen(true);
            }}
            disabled={isSaving}
          >
            <Save className="mr-2 h-3.5 w-3.5" /> Save current as template
          </DropdownMenuItem>
          {templates.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FileText className="mr-2 h-3.5 w-3.5" /> Use template
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="z-99999 w-60">
                <div className="p-2 border-b border-border sticky top-0 bg-background">
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-30 overflow-y-auto">
                  {filteredTemplates.map((t: Template) => (
                    <DropdownMenuItem
                      key={t.id}
                      className="flex items-center justify-between gap-2"
                      onClick={() => handleApplyTemplate(t)}
                    >
                      <span className="flex-1 truncate text-left">{t.name}</span>
                      <button
                        className="p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false); 
                          toast(`Delete template "${t.name}"?`, {
                            duration: 10000,
                            action: {
                              label: 'Delete',
                              onClick: () => handleDeleteTemplate(t.id),
                            },
                            className: 'pointer-events-auto',
                            style: {
                              pointerEvents: 'auto',
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">No templates</div>
                  )}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent showOverlay>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const TemplateButton = React.memo(TemplateButtonComponent); 