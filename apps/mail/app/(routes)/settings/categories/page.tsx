import { useSettings } from '@/hooks/use-settings';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { toast } from 'sonner';
import type { CategorySetting } from '@/hooks/use-categories';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import * as Icons from '@/components/icons/icons';
import { Sparkles } from '@/components/icons/icons';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function CategoriesSettingsPage() {
  const { data } = useSettings();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync: saveUserSettings, isPending } = useMutation(
    trpc.settings.save.mutationOptions(),
  );

  const { mutateAsync: generateSearchQuery, isPending: isGeneratingQuery } = useMutation(
    trpc.ai.generateSearchQuery.mutationOptions(),
  );

  const { data: defaultMailCategories = [] } = useQuery(
    trpc.categories.defaults.queryOptions(void 0, { staleTime: Infinity }),
  );

  const [categories, setCategories] = useState<CategorySetting[]>([]);
  const [activeAiCat, setActiveAiCat] = useState<string | null>(null);
  const [promptValues, setPromptValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!defaultMailCategories.length) return;

    const stored = data?.settings?.categories ?? [];

    const merged = defaultMailCategories.map((def) => {
      const override = stored.find((c: { id: string }) => c.id === def.id);
      return override ? { ...def, ...override } : def;
    });

    setCategories(merged.sort((a, b) => a.order - b.order));
  }, [data, defaultMailCategories]);

  const handleFieldChange = (id: string, field: keyof CategorySetting, value: string | number | boolean) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat)),
    );
  };

  const handleSave = async () => {
    if (categories.filter((c) => c.isDefault).length !== 1) {
      toast.error('Please mark exactly one category as default');
      return;
    }

    const orderValues = categories.map((c) => c.order);
    const hasDuplicateOrders = new Set(orderValues).size !== orderValues.length;
    if (hasDuplicateOrders) {
      toast.error('Each category must have a unique order number');
      return;
    }

    const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

    try {
      await saveUserSettings({ categories: sortedCategories });
      queryClient.setQueryData(trpc.settings.get.queryKey(), (updater) => {
        if (!updater) return;
        return {
          settings: { ...updater.settings, categories: sortedCategories },
        };
      });
      setCategories(sortedCategories);
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
    <div className="grid gap-6 max-w-[900px] mx-auto">
      <SettingsCard
        title="Mail Categories"
        description="Customise how Zero shows the category tabs in your inbox."
        footer={
          <div className="px-6">
            <Button type="button" disabled={isPending} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-6">
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal bg-background">
                    {cat.id}
                  </Badge>
                  {cat.isDefault && (
                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-200 text-xs">
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`default-${cat.id}`}
                    checked={!!cat.isDefault}
                    onCheckedChange={(val) => {
                      const newCats = categories.map((c) => ({
                        ...c,
                        isDefault: c.id === cat.id ? val : false,
                      }));
                      setCategories(newCats);
                    }}
                  />
                  <Label htmlFor={`default-${cat.id}`} className="text-xs font-normal cursor-pointer">
                    Set as Default
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-xs mb-1.5 block">Display Name</Label>
                  <Input
                    className="h-8 text-sm"
                    value={cat.name}
                    onChange={(e) => handleFieldChange(cat.id, 'name', e.target.value)}
                  />
                </div>
                
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-xs mb-1.5 block">Icon</Label>
                  <Select
                    value={cat.icon ?? ''}
                    onValueChange={(val) => handleFieldChange(cat.id, 'icon', val)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select icon">
                        {cat.icon && (
                          <div className="flex items-center gap-2">
                            {(() => {
                              const IconComp = Icons[cat.icon as keyof typeof Icons];
                              return IconComp ? <IconComp className="size-4 fill-muted-foreground" /> : null;
                            })()}
                            <span className="truncate">{cat.icon}</span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {Object.keys(Icons).map((iconName) => {
                        const IconComp = Icons[iconName as keyof typeof Icons];
                        if (typeof IconComp !== 'function') return null;
                        return (
                          <SelectItem value={iconName} key={iconName}>
                            <div className="flex items-center gap-2">
                              <IconComp className="size-4 fill-muted-foreground" />
                              <span>{iconName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-xs mb-1.5 block">Search Query</Label>
                  <div className="relative">
                    <Input
                      className="pr-8 h-8 text-sm font-mono"
                      value={cat.searchValue}
                      onChange={(e) => handleFieldChange(cat.id, 'searchValue', e.target.value)}
                    />

                    <Popover
                      open={activeAiCat === cat.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setActiveAiCat(cat.id);
                        } else {
                          setActiveAiCat(null);
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background hover:bg-secondary rounded-full p-1"
                          aria-label="Generate search query with AI"
                        >
                          {isGeneratingQuery && activeAiCat === cat.id ? (
                            <Loader className="h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 fill-[#8B5CF6]" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-3 space-y-3" sideOffset={4} align="end">
                        <div className="space-y-1">
                          <Label className="text-xs">Natural Language Query</Label>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Describe the emails to include…"
                            value={promptValues[cat.id] ?? ''}
                            onChange={(e) =>
                              setPromptValues((prev) => ({ ...prev, [cat.id]: e.target.value }))
                            }
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Example: "emails that mention quarterly reports"
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={!(promptValues[cat.id]?.trim()) || isGeneratingQuery}
                          onClick={async () => {
                            const prompt = promptValues[cat.id]?.trim();
                            if (!prompt) return;
                            try {
                              const res = await generateSearchQuery({ query: prompt });
                              handleFieldChange(cat.id, 'searchValue', res.query);
                              toast.success('Search query generated');
                              setActiveAiCat(null);
                            } catch (err) {
                              console.error(err);
                              toast.error('Failed to generate query');
                            }
                          }}
                        >
                          {isGeneratingQuery && activeAiCat === cat.id ? (
                            <Loader className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Sparkles className="h-3 w-3 fill-white mr-1" />
                          )}
                          Generate Query
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="col-span-12 sm:col-span-2">
                  <Label className="text-xs mb-1.5 block">Order</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={cat.order}
                    min={0}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = val === '' ? undefined : Number(val);
                      handleFieldChange(
                        cat.id,
                        'order',
                        parsed === undefined || Number.isNaN(parsed) ? cat.order : parsed,
                      );
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}