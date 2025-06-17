import { useSettings } from '@/hooks/use-settings';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { toast } from 'sonner';
import type { CategorySetting } from '@/hooks/use-categories';
import { defaultMailCategories } from '../../../../../server/src/lib/schemas';

export default function CategoriesSettingsPage() {
  const { data } = useSettings();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: saveUserSettings, isPending } = useMutation(
    trpc.settings.save.mutationOptions(),
  );

  const [categories, setCategories] = useState<CategorySetting[]>([]);

  useEffect(() => {
    const stored = data?.settings?.categories ?? [];

    const merged = defaultMailCategories.map((def) => {
      const override = stored.find((c: { id: string; }) => c.id === def.id);
      return override ? { ...def, ...override } : def;
    });

    setCategories(merged.sort((a, b) => a.order - b.order));
  }, [data]);

  const handleFieldChange = (id: string, field: keyof CategorySetting, value: any) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat)),
    );
  };

  const handleSave = async () => {
    if (categories.filter((c) => c.isDefault).length !== 1) {
      toast.error('Please mark exactly one category as default');
      return;
    }

    try {
      await saveUserSettings({ categories });
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater: any) => {
        if (!updater) return;
        return {
          settings: { ...updater.settings, categories },
        };
      });
      toast.success('Categories saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    }
  };

  if (!categories.length) {
    return <div className="text-muted-foreground p-6">Loading...</div>;
  }

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Mail Categories"
        description="Customise how Zero shows the category tabs in your inbox."
        footer={
          <Button type="button" disabled={isPending} onClick={handleSave}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        }
      >
        <div className="space-y-4">
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-2 rounded-md border p-4">
              <Label className="text-xs font-medium text-muted-foreground">
                System Id: {cat.id}
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={cat.name}
                    onChange={(e) => handleFieldChange(cat.id, 'name', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Search Query</Label>
                  <Input
                    value={cat.searchValue}
                    onChange={(e) => handleFieldChange(cat.id, 'searchValue', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Order</Label>
                  <Input
                    type="number"
                    value={cat.order}
                    min={0}
                    onChange={(e) => handleFieldChange(cat.id, 'order', Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <Switch
                    checked={!!cat.isDefault}
                    onCheckedChange={(val) => {
                      const newCats = categories.map((c) => ({
                        ...c,
                        isDefault: c.id === cat.id ? val : false,
                      }));
                      setCategories(newCats);
                    }}
                  />
                  <span>Default</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
} 