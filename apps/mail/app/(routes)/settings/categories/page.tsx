import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SettingsCard } from '@/components/settings/settings-card';
import { Check, ChevronDown, Trash2, Plus } from 'lucide-react';
import type { CategorySetting } from '@/hooks/use-categories';
import { defaultMailCategories } from '@zero/server/schemas';
import React, { useState, useEffect, useMemo } from 'react';
import { useTRPC } from '@/providers/query-provider';
import { useSettings } from '@/hooks/use-settings';
import type { DragEndEvent } from '@dnd-kit/core';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';
import { useLabels } from '@/hooks/use-labels';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GripVertical } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';

interface SortableCategoryItemProps {
  cat: CategorySetting;
  handleFieldChange: (id: string, field: keyof CategorySetting, value: any) => void;
  toggleDefault: (id: string) => void;
  handleDeleteCategory: (id: string) => void;
  allLabels: Array<{ id: string; name: string; type: string }>;
}

const SortableCategoryItem = React.memo(function SortableCategoryItem({
  cat,
  handleFieldChange,
  toggleDefault,
  handleDeleteCategory,
  allLabels,
}: SortableCategoryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleLabelToggle = React.useCallback(
    (labelId: string, isSelected: boolean) => (e: React.MouseEvent) => {
      e.preventDefault();
      const currentLabels = cat.searchValue ? cat.searchValue.split(',').filter(Boolean) : [];
      let newLabels;

      if (isSelected) {
        newLabels = currentLabels.filter((id) => id !== labelId);
      } else {
        newLabels = [...currentLabels, labelId];
      }

      handleFieldChange(cat.id, 'searchValue', newLabels.join(','));
    },
    [cat.id, cat.searchValue, handleFieldChange],
  );

  const handleDeleteClick = React.useCallback(() => {
    handleDeleteCategory(cat.id);
  }, [cat.id, handleDeleteCategory]);

  const handleToggleDefault = React.useCallback(() => {
    toggleDefault(cat.id);
  }, [cat.id, toggleDefault]);

  const handleNameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFieldChange(cat.id, 'name', e.target.value);
    },
    [cat.id, handleFieldChange],
  );

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
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="hover:bg-muted/50 cursor-grab rounded p-1 transition-colors active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="text-muted-foreground h-4 w-4" />
          </button>
          <Badge variant="outline" className="bg-background text-xs font-normal">
            {cat.id}
          </Badge>
          {cat.isDefault && (
            <Badge className="border-blue-200 bg-blue-500/10 text-xs text-blue-500">Default</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteClick}
            className="text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Switch
            id={`default-${cat.id}`}
            checked={!!cat.isDefault}
            onCheckedChange={handleToggleDefault}
          />
          <Label htmlFor={`default-${cat.id}`} className="cursor-pointer text-xs font-normal">
            Set as Default
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-12 items-start gap-4">
        <div className="col-span-12 sm:col-span-6">
          <Label className="mb-1.5 block text-xs">Display Name</Label>
          <Input className="h-8 text-sm" value={cat.name} onChange={handleNameChange} />
        </div>

        <div className="col-span-6">
          <Label className="mb-1.5 block text-xs">Label Filters</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8 w-full justify-between text-sm">
                <span>
                  {(() => {
                    const selectedLabels = cat.searchValue
                      ? cat.searchValue.split(',').filter(Boolean)
                      : [];
                    if (selectedLabels.length === 0) return 'Select labels...';
                    if (selectedLabels.length === 1) {
                      const label = allLabels.find((l) => l.id === selectedLabels[0]);
                      return label?.name || 'Unknown label';
                    }
                    return `${selectedLabels.length} labels selected`;
                  })()}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-64 w-56 overflow-y-auto">
              {allLabels.map((label) => {
                const selectedLabels = cat.searchValue
                  ? cat.searchValue.split(',').filter(Boolean)
                  : [];
                const isSelected = selectedLabels.includes(label.id);

                return (
                  <DropdownMenuItem
                    key={label.id}
                    className="flex cursor-pointer items-center justify-between"
                    onClick={handleLabelToggle(label.id, isSelected)}
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={label.type === 'system' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {label.name}
                      </Badge>
                    </div>
                    {isSelected && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
});

export default function CategoriesSettingsPage() {
  const { data } = useSettings();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { userLabels, systemLabels } = useLabels();
  const allLabels = useMemo(() => [...systemLabels, ...userLabels], [systemLabels, userLabels]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { mutateAsync: saveUserSettings } = useMutation(trpc.settings.save.mutationOptions());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const initialCategories = useMemo(() => {
    const stored = data?.settings?.categories ?? [];
    return stored.slice().sort((a, b) => a.order - b.order);
  }, [data?.settings?.categories]);
  const [categories, setCategories] = useState<CategorySetting[]>(initialCategories);

  useEffect(() => {
    setCategories(initialCategories);
    setHasUnsavedChanges(false);
  }, [data?.settings?.categories]);

  const handleFieldChange = (
    id: string,
    field: keyof CategorySetting,
    value: string | number | boolean,
  ) => {
    const updatedCategories = categories.map((cat) =>
      cat.id === id ? { ...cat, [field]: value } : cat,
    );
    setCategories(updatedCategories);
    setHasUnsavedChanges(true);
  };

  const toggleDefault = (id: string) => {
    const updatedCategories = categories.map((c) => ({
      ...c,
      isDefault: c.id === id ? !c.isDefault : false,
    }));
    setCategories(updatedCategories);
    setHasUnsavedChanges(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((cat) => cat.id === active.id);
    const newIndex = categories.findIndex((cat) => cat.id === over.id);

    const reorderedCategories = arrayMove(categories, oldIndex, newIndex).map((cat, index) => ({
      ...cat,
      order: index,
    }));

    setCategories(reorderedCategories);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      const defaultCategoryCount = categories.filter((cat) => cat.isDefault).length;
      if (defaultCategoryCount !== 1) {
        toast.error('Exactly one category must be set as default');
        return;
      }
      await saveUserSettings({ categories });
      queryClient.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });
      setHasUnsavedChanges(false);
      toast.success('Categories saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save');
    }
  };

  const handleDeleteCategory = (id: string) => {
    const categoryToDelete = categories.find((cat) => cat.id === id);

    if (categoryToDelete?.isDefault) {
      const remainingCategories = categories.filter((cat) => cat.id !== id);

      if (remainingCategories.length === 0) {
        toast.error('Cannot delete the last remaining category');
        return;
      }

      const updatedCategories = remainingCategories.map((cat, index) =>
        index === 0 ? { ...cat, isDefault: true } : cat,
      );

      setCategories(updatedCategories);
      toast.success('Default category reassigned to the first remaining category');
    } else {
      const updatedCategories = categories.filter((cat) => cat.id !== id);
      setCategories(updatedCategories);
    }

    setHasUnsavedChanges(true);
  };

  const handleAddCategory = () => {
    const newCategory: CategorySetting = {
      id: `custom-${crypto.randomUUID()}`,
      name: 'New Category',
      searchValue: '',
      order: categories.length,
      isDefault: false,
    };
    setCategories([...categories, newCategory]);
    setHasUnsavedChanges(true);
  };

  const handleResetToDefaults = async () => {
    try {
      await saveUserSettings({ categories: defaultMailCategories });
      queryClient.invalidateQueries({ queryKey: trpc.settings.get.queryKey() });
      setHasUnsavedChanges(false);
      toast.success('Reset to defaults');
    } catch (e) {
      console.error(e);
      toast.error('Failed to reset');
    }
  };

  if (!categories.length) {
    return <div className="text-muted-foreground p-6">Loading...</div>;
  }

  return (
    <SettingsCard
      title={m['navigation.settings.categories']()}
      description="Customise how Zero shows the category tabs in your inbox. Drag and drop to reorder."
      footer={
        <div className="flex justify-between">
          <Button type="button" variant="outline" onClick={handleResetToDefaults}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            {hasUnsavedChanges && (
              <span className="flex items-center text-sm text-amber-600">Unsaved changes</span>
            )}
            <Button type="button" onClick={handleSave} disabled={!hasUnsavedChanges}>
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={handleAddCategory} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={categories.map((cat) => cat.id)}
            strategy={verticalListSortingStrategy}
          >
            {categories.map((cat) => (
              <SortableCategoryItem
                key={cat.id}
                cat={cat}
                handleFieldChange={handleFieldChange}
                toggleDefault={toggleDefault}
                handleDeleteCategory={handleDeleteCategory}
                allLabels={allLabels}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </SettingsCard>
  );
}
