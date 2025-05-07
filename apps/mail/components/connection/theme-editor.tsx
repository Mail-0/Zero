import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const themeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  config: z.object({
    primary: z.string(),
    background: z.string(),
    text: z.string(),
    font: z.string(),
    radius: z.string(),
    shadow: z.string(),
    spacing: z.string(),
  }),
  isPublic: z.boolean().optional(),
});

type ThemeFormValues = z.infer<typeof themeSchema>;


interface ThemeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: ThemeFormValues & { id?: string };
  onSave: (values: ThemeFormValues) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function ThemeEditor({ open, onOpenChange, initialValues, onSave, onDelete }: ThemeEditorProps) {
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    if (!initialValues?.id) return;
    const confirmed = window.confirm('Are you sure you want to delete this theme? This action cannot be undone.');
    if (!confirmed) return;
    setDeleting(true);
    try {
      // Call backend DELETE endpoint
      await fetch(`/api/themes/${initialValues.id}`, { method: 'DELETE' });
      if (onDelete) await onDelete(initialValues.id);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  }
  const form = useForm<ThemeFormValues>({
    resolver: zodResolver(themeSchema),
    defaultValues: initialValues || {
      name: '',
      description: '',
      config: {
        primary: '#437DFB',
        background: '#FFFFFF',
        text: '#222222',
        font: 'Inter',
        radius: '0.5rem',
        shadow: '0 2px 8px rgba(0,0,0,0.08)',
        spacing: '1rem',
      },
      isPublic: false,
    },
  });

  const [saving, setSaving] = useState(false);

  // Accessibility: focus management
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [open]);

  async function handleSubmit(values: ThemeFormValues) {
    setSaving(true);
    await onSave(values);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-editor-title"
      >
        <DialogHeader>
          <DialogTitle id="theme-editor-title">{initialValues ? 'Edit Theme' : 'Create Theme'}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <div>
            <label className="block text-sm font-medium" htmlFor="theme-name-input">Name</label>
            <input
              id="theme-name-input"
              ref={nameInputRef}
              {...form.register('name', { required: true })}
              className="input input-bordered w-full"
              aria-invalid={!!form.formState.errors.name}
              aria-describedby={form.formState.errors.name ? 'theme-name-error' : undefined}
            />
            {form.formState.errors.name && (
              <div id="theme-name-error" role="alert" className="text-xs text-red-600 mt-1">
                {form.formState.errors.name.message || 'Name is required'}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium" htmlFor="theme-description-input">Description</label>
            <input
              id="theme-description-input"
              {...form.register('description')}
              className="input input-bordered w-full"
              aria-invalid={!!form.formState.errors.description}
              aria-describedby={form.formState.errors.description ? 'theme-description-error' : undefined}
            />
            {form.formState.errors.description && (
              <div id="theme-description-error" role="alert" className="text-xs text-red-600 mt-1">
                {form.formState.errors.description.message}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs">Primary Color</label>
              <input type="color" {...form.register('config.primary')} />
            </div>
            <div>
              <label className="block text-xs">Background</label>
              <input type="color" {...form.register('config.background')} />
            </div>
            <div>
              <label className="block text-xs">Text Color</label>
              <input type="color" {...form.register('config.text')} />
            </div>
            <div>
            <label className="block text-xs">Font</label>
            <select {...form.register('config.font')} className="input input-bordered w-full">
              <option value="Inter">Inter</option>
              <option value="Geist">Geist</option>
              <option value="Roboto">Roboto</option>
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
              <option value="monospace">Monospace</option>
            </select>
            </div>
            <div>
              <label className="block text-xs">Radius</label>
              <input
                type="range"
                min="0"
                max="48"
                step="1"
                value={parseInt(form.watch('config.radius')?.replace('px', '').replace('rem', '') || '8')}
                onChange={e => {
                  // Store as px for simplicity
                  form.setValue('config.radius', `${e.target.value}px`);
                }}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground mt-1">{form.watch('config.radius') || '8px'}</div>
            </div>
            <div>
              <label className="block text-xs">Shadow</label>
              <select {...form.register('config.shadow')} className="input input-bordered w-full">
                <option value="none">None</option>
                <option value="0 1px 2px rgba(0,0,0,0.05)">Small</option>
                <option value="0 2px 8px rgba(0,0,0,0.08)">Medium</option>
                <option value="0 4px 16px rgba(0,0,0,0.12)">Large</option>
                <option value="0 8px 32px rgba(0,0,0,0.16)">Extra Large</option>
                <option value="inset 0 2px 4px rgba(0,0,0,0.06)">Inset</option>
                <option value="custom">Custom (edit below)</option>
              </select>
              {form.watch('config.shadow') === 'custom' && (
                <div className="mt-1">
                  <label htmlFor="custom-shadow-input" className="block text-xs mb-1">Custom Shadow CSS</label>
                  <input
                    id="custom-shadow-input"
                    {...form.register('config.shadow')}
                    className="input input-bordered w-full"
                    placeholder="e.g. 0 2px 8px rgba(0,0,0,0.08)"
                    aria-label="Custom shadow CSS value"
                  />
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs">Spacing</label>
              <input
                type="range"
                min="0"
                max="64"
                step="1"
                value={parseInt(form.watch('config.spacing')?.replace('px', '').replace('rem', '') || '16')}
                onChange={e => {
                  // Store as px for simplicity
                  form.setValue('config.spacing', `${e.target.value}px`);
                }}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground mt-1">{form.watch('config.spacing') || '16px'}</div>
            </div>
          </div>
          {/* Live Preview Section */}
          <div className="my-4">
            <label className="block text-xs font-semibold mb-2 text-muted-foreground">Live Preview</label>
            <div
              aria-hidden="true"
              style={{
                background: form.watch('config.background') || '#fff',
                color: form.watch('config.text') || '#222',
                fontFamily: form.watch('config.font') || 'Inter',
                borderRadius: form.watch('config.radius') || '8px',
                boxShadow: form.watch('config.shadow') && form.watch('config.shadow') !== 'none' && form.watch('config.shadow') !== 'custom' ? form.watch('config.shadow') : undefined,
                padding: form.watch('config.spacing') || '16px',
                border: `2px solid ${form.watch('config.primary') || '#437DFB'}`,
                minHeight: 80,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}
            >
              <div style={{textAlign: 'center', width: '100%'}}>
                <div style={{fontWeight: 600, fontSize: 18}}>Sample Title</div>
                <div style={{fontSize: 14, opacity: 0.8}}>This is a live preview of your theme.</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.watch('isPublic')}
                onChange={e => form.setValue('isPublic', e.target.checked)}
                className="accent-blue-600"
                id="make-public-checkbox"
                aria-checked={!!form.watch('isPublic')}
                aria-label="Make this theme public"
                {...form.register('isPublic')}
              />
              <span className="text-xs" id="make-public-label">Make Public</span>
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {initialValues?.id && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Theme'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
