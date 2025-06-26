import { useSettings } from '@/hooks/use-settings';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useCallback } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { toast } from 'sonner';
import type { CategorySetting } from '@/hooks/use-categories';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import * as Icons from '@/components/icons/icons';
import { Sparkles } from '@/components/icons/icons';
import { Loader, GripVertical } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-card p-4 shadow-sm ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 transition-colors"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
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
            onCheckedChange={() => toggleDefault(cat.id)}
          />
          <Label htmlFor={`default-${cat.id}`} className="text-xs font-normal cursor-pointer">
            Set as Default
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        <div className="col-span-12 sm:col-span-6">
          <Label className="text-xs mb-1.5 block">Display Name</Label>
          <Input
            className="h-8 text-sm"
            value={cat.name}
            onChange={(e) => handleFieldChange(cat.id, 'name', e.target.value)}
          />
        </div>
        
        <div className="col-span-12 sm:col-span-6">
          <Label className="text-xs mb-1.5 block">Search Query</Label>
          <div className="relative">
            <Input
              className="pr-8 h-8 text-sm font-mono"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background hover:bg-secondary rounded-full p-1"
                  aria-label="Generate search query with AI"
                >
                  {isGeneratingQuery && isActiveAi ? (
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
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
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

  const toggleDefault = useCallback(
    (id: string) => {
      setCategories((prev) =>
        prev.map((c) => ({ ...c, isDefault: c.id === id ? !c.isDefault : false })),
      );
    },
    [],
  );

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
    <div className="grid gap-6 max-w-[900px] mx-auto">
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
                  setPromptValue={(val) =>
                    setPromptValues((prev) => ({ ...prev, [cat.id]: val }))
                  }
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