import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import type { CategorySetting } from '@/hooks/use-categories';
import { useState, useEffect, useCallback } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { Sparkles } from '@/components/icons/icons';
import { Loader, GripVertical } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';
import * as Icons from '@/components/icons/icons';
import type { DragEndEvent } from '@dnd-kit/core';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import React from 'react';

interface SortableCategoryItemProps {
  cat: CategorySetting;
  isActiveAi: boolean;
  promptValue: string;
  setPromptValue: (val: string) => void;
  setActiveAiCat: (id: string | null) => void;
  isGeneratingQuery: boolean;
  generateSearchQuery: (params: { query: string }) => Promise<{ query: string }>;
  handleFieldChange: (id: string, field: keyof CategorySetting, value: any) => void;
  toggleDefault: (id: string) => void;
}

const SortableCategoryItem = React.memo(function SortableCategoryItem({
  cat,
  isActiveAi,
  promptValue,
  setPromptValue,
  setActiveAiCat,
  isGeneratingQuery,
  generateSearchQuery,
  handleFieldChange,
  toggleDefault,
}: SortableCategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-border bg-card rounded-lg border p-4 shadow-sm ${
        isDragging ? 'scale-95 opacity-50' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="hover:bg-muted/50 cursor-grab rounded p-1 transition-colors active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="text-muted-foreground h-4 w-4" />
          </div>
          <Badge variant="outline" className="bg-background text-xs font-normal">
            {cat.id}
          </Badge>
          {cat.isDefault && (
            <Badge className="border-blue-200 bg-blue-500/10 text-xs text-blue-500">Default</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`default-${cat.id}`}
            checked={!!cat.isDefault}
            onCheckedChange={() => toggleDefault(cat.id)}
          />
          <Label htmlFor={`default-${cat.id}`} className="cursor-pointer text-xs font-normal">
            Set as Default
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-4">
        <div className="col-span-12 sm:col-span-6">
          <Label className="mb-1.5 block text-xs">Display Name</Label>
          <Input
            className="h-8 text-sm"
            value={cat.name}
            onChange={(e) => handleFieldChange(cat.id, 'name', e.target.value)}
          />
        </div>

        <div className="col-span-12 sm:col-span-6">
          <Label className="mb-1.5 block text-xs">Search Query</Label>
          <div className="relative">
            <Input
              className="h-8 pr-8 font-mono text-sm"
              value={cat.searchValue}
              onChange={(e) => handleFieldChange(cat.id, 'searchValue', e.target.value)}
            />

            <Popover
              open={isActiveAi}
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
                  className="bg-background hover:bg-secondary absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1"
                  aria-label="Generate search query with AI"
                >
                  {isGeneratingQuery && isActiveAi ? (
                    <Loader className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 fill-[#8B5CF6]" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3 p-3" sideOffset={4} align="end">
                <div className="space-y-1">
                  <Label className="text-xs">Natural Language Query</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Describe the emails to include…"
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                  />
                </div>
                <div className="text-muted-foreground text-xs">
                  Example: "emails that mention quarterly reports"
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!promptValue.trim() || isGeneratingQuery}
                  onClick={async () => {
                    const prompt = promptValue.trim();
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
                  {isGeneratingQuery && isActiveAi ? (
                    <Loader className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3 fill-white" />
                  )}
                  Generate Query
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </div>
  );
});

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const toggleDefault = useCallback((id: string) => {
    setCategories((prev) =>
      prev.map((c) => ({ ...c, isDefault: c.id === id ? !c.isDefault : false })),
    );
  }, []);

  useEffect(() => {
    if (!defaultMailCategories.length) return;

    const stored = data?.settings?.categories ?? [];

    const merged = defaultMailCategories.map((def) => {
      const override = stored.find((c: { id: string }) => c.id === def.id);
      return override ? { ...def, ...override } : def;
    });

    setCategories(merged.sort((a, b) => a.order - b.order));
  }, [data, defaultMailCategories]);

  const handleFieldChange = (
    id: string,
    field: keyof CategorySetting,
    value: string | number | boolean,
  ) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setCategories((prev) => {
      const oldIndex = prev.findIndex((cat) => cat.id === active.id);
      const newIndex = prev.findIndex((cat) => cat.id === over.id);

      const reorderedCategories = arrayMove(prev, oldIndex, newIndex);

      return reorderedCategories.map((cat, index) => ({
        ...cat,
        order: index,
      }));
    });
  };

  const handleSave = async () => {
    if (categories.filter((c) => c.isDefault).length !== 1) {
      toast.error('Please mark exactly one category as default');
      return;
    }

    const sortedCategories = categories.map((cat, index) => ({
      ...cat,
      order: index,
    }));

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
    <div className="mx-auto grid max-w-[900px] gap-6">
      <SettingsCard
        title="Mail Categories"
        description="Customise how Zero shows the category tabs in your inbox. Drag and drop to reorder."
        footer={
          <div className="px-6">
            <Button type="button" disabled={isPending} onClick={handleSave}>
              {isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={categories.map((cat) => cat.id)}
              strategy={verticalListSortingStrategy}
            >
              {categories.map((cat) => (
                <SortableCategoryItem
                  key={cat.id}
                  cat={cat}
                  isActiveAi={activeAiCat === cat.id}
                  promptValue={promptValues[cat.id] ?? ''}
                  setPromptValue={(val) => setPromptValues((prev) => ({ ...prev, [cat.id]: val }))}
                  setActiveAiCat={setActiveAiCat}
                  isGeneratingQuery={isGeneratingQuery}
                  generateSearchQuery={generateSearchQuery}
                  handleFieldChange={handleFieldChange}
                  toggleDefault={toggleDefault}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </SettingsCard>
    </div>
  );
}
