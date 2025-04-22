'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SettingsCard } from '@/components/settings/settings-card';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { GMAIL_COLORS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface LabelFormData {
  id?: string;
  name: string;
  color: {
    backgroundColor: string;
    textColor: string;
  };
}

export default function LabelsPage() {
  const t = useTranslations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [labels, setLabels] = useState<LabelFormData[]>([]);
  const [editingLabel, setEditingLabel] = useState<LabelFormData | null>(null);
  const [formData, setFormData] = useState<LabelFormData>({
    name: '',
    color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const response = await fetch('/api/v1/labels');
        if (!response.ok) throw new Error('Failed to fetch labels');
        const userLabels = await response.json();
        const formattedLabels = userLabels.map((label: any) => ({
          ...label,
        }));

        console.log(formattedLabels);
        setLabels(formattedLabels);
      } catch (err) {
        console.error('Error fetching labels:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabels();
  }, []);

  const handleSubmit = async () => {
    try {
      if (editingLabel) {
        const response = await fetch(`/api/v1/labels`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingLabel.id, ...formData }),
        });
        if (!response.ok) throw new Error('Failed to update label');
      } else {
        const response = await fetch('/api/v1/labels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!response.ok) throw new Error('Failed to create label');
      }

      // Refresh labels after successful update
      const response = await fetch('/api/v1/labels');
      if (!response.ok) throw new Error('Failed to fetch labels');
      const userLabels = await response.json();
      const formattedLabels = userLabels.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color || { backgroundColor: '#E2E2E2', textColor: '#000000' },
      }));
      setLabels(formattedLabels);
      handleClose();
    } catch (err) {
      console.error('Error saving label:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch('/api/v1/labels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to delete label');

      // Refresh labels after successful deletion
      const labelsResponse = await fetch('/api/v1/labels');
      if (!labelsResponse.ok) throw new Error('Failed to fetch labels');
      const userLabels = await labelsResponse.json();
      const formattedLabels = userLabels.map((label: any) => ({
        id: label.id,
        name: label.name,
        color: label.color?.backgroundColor
          ? Object.entries(GMAIL_COLORS).find(
              ([_, c]) => c.backgroundColor === label.color.backgroundColor,
            )?.[0] || 'default'
          : 'default',
      }));
      setLabels(formattedLabels);
    } catch (err) {
      console.error('Error deleting label:', err);
    }
  };

  const handleEdit = (label: LabelFormData) => {
    setEditingLabel(label);
    setFormData({
      name: label.name,
      color: label.color || (GMAIL_COLORS[0] || { name: 'default' }).name,
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingLabel(null);
    setFormData({
      name: '',
      color: { backgroundColor: '#E2E2E2', textColor: '#000000' },
    });
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title={t('pages.settings.labels.title')}
        description={t('pages.settings.labels.description')}
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingLabel(null)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Label
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLabel ? 'Edit Label' : 'Create New Label'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Label Name</Label>
                  <Input
                    placeholder="Enter label name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {GMAIL_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            color: {
                              backgroundColor: color.backgroundColor,
                              textColor: color.textColor,
                            },
                          })
                        }
                        style={{
                          height: '2rem',
                          backgroundColor: color.backgroundColor,
                          color: color.textColor,
                          borderRadius: '0.375rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ...(formData.color.backgroundColor === color.backgroundColor && {
                            outline: '2px solid var(--primary)',
                            outlineOffset: '2px',
                          }),
                        }}
                      >
                        {formData.color.backgroundColor === color.backgroundColor && (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.name.trim()}>
                  {editingLabel ? 'Save Changes' : 'Create Label'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        <div className="space-y-6">
          <Separator />
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-muted-foreground py-4 text-center text-sm">Loading labels...</p>
              ) : labels.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No labels created yet. Click the button above to create one.
                </p>
              ) : (
                labels.map((label) => {
                  // const colorStyle = GMAIL_COLORS.find((c) => c.name === label.color) ||
                  //   GMAIL_COLORS[0] || {
                  //     name: 'default',
                  //     backgroundColor: '#E2E2E2',
                  //     textColor: '#000000',
                  //   };
                  return (
                    <div key={label.id} className="group flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge
                          className="px-2 py-1"
                          style={{
                            backgroundColor: label.color.backgroundColor,
                            color: label.color.textColor,
                          }}
                        >
                          {label.name}
                        </Badge>
                      </div>
                      <div className="space-x-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(label)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(label.id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </SettingsCard>
    </div>
  );
}
