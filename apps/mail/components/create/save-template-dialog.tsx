"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { useTemplates } from '../../hooks/use-templates';
import { toast } from 'sonner';

interface SaveTemplateDialogProps {
  subject: string;
  content: string;
  trigger?: React.ReactNode;
  onTemplateSaved?: () => void;
}

export function SaveTemplateDialog({ 
  subject, 
  content, 
  trigger,
  onTemplateSaved 
}: SaveTemplateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const { createTemplate } = useTemplates();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (!content.trim()) {
      toast.error('Cannot save empty template');
      return;
    }

    setSaving(true);
    try {
      await createTemplate({
        name: name.trim(),
        subject: subject || '',
        content: content,
      });
      
      setOpen(false);
      setName('');
      onTemplateSaved?.();
    } catch (error) {
      // Error is handled by the hook
      console.error('Failed to save template:', error);
    } finally {
      setSaving(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Save className="h-4 w-4 mr-2" />
      Save Template
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !saving) {
                  handleSave();
                }
              }}
            />
          </div>
          {subject && (
            <div className="space-y-2">
              <Label>Subject Preview</Label>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                {subject}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Content Preview</Label>
            <div className="text-sm text-muted-foreground p-2 bg-muted rounded max-h-32 overflow-y-auto">
              {content.length > 100 ? `${content.substring(0, 100)}...` : content}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || !content.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}