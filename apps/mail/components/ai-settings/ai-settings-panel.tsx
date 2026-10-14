import {
  AiSettingsLayoutContext,
  useAiSettingsLayout,
  IconTile,
  PaneFooter,
  SectionHeader,
  field,
  hairline,
  primaryButton,
  subtleButton,
  surface,
  type AiSettingsLayout,
} from './ui';
import {
  Ban,
  BrainCircuit,
  FileText,
  ListChecks,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  Tags,
  Trash2,
  Zap,
} from 'lucide-react';
import { MAX_AI_LABELS, aiSettingsSchema, type AiSettings } from '@zero/server/schemas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { defaultLabels } from '../../../server/src/types';
import { useAiSettings } from '@/hooks/use-ai-settings';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useBilling } from '@/hooks/use-billing';
import { PromptsEditor } from './prompts-editor';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type AiLabel = NonNullable<AiSettings['labels']>[number];

const SECTIONS = [
  { value: 'features', label: 'Features', icon: Zap },
  { value: 'labels', label: 'Auto labels', icon: Tags },
  { value: 'prompts', label: 'Prompts', icon: FileText },
] as const;

/**
 * AI settings: background features, plan usage, auto-label list and prompts.
 * `dialog` renders a side nav with a scrolling pane; `page` renders inline tabs.
 */
export function AiSettingsPanel({ layout = 'page' }: { layout?: AiSettingsLayout }) {
  const isDialog = layout === 'dialog';
  const { settings } = useAiSettings();
  const [tab, setTab] = useState<string>('features');
  // With AI off only the master switch matters, so the other sections lock.
  const activeTab = settings.disabled ? 'features' : tab;

  return (
    <AiSettingsLayoutContext.Provider value={layout}>
      <Tabs
        value={activeTab}
        onValueChange={setTab}
        orientation={isDialog ? 'vertical' : 'horizontal'}
        className={cn('w-full', isDialog && 'flex min-h-0 flex-1 flex-col md:flex-row')}
      >
        <TabsList
          className={cn(
            'h-auto shrink-0 justify-start gap-1 rounded-none bg-transparent p-0',
            isDialog
              ? cn(
                  'overflow-x-auto border-b px-3 py-2 md:w-48 md:flex-col md:items-stretch md:border-r md:border-b-0 md:p-3',
                  hairline,
                )
              : cn('w-full border-b pb-2', hairline),
          )}
        >
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              disabled={settings.disabled && value !== 'features'}
              className={cn(
                'text-muted-foreground hover:text-foreground h-8 justify-start gap-2 rounded-lg px-2.5 text-[13px] font-normal',
                'data-[state=active]:text-foreground data-[state=active]:bg-[#F0F0F0] data-[state=active]:shadow-none dark:data-[state=active]:bg-[#252525]',
                'hover:bg-[#F5F5F5] dark:hover:bg-[#202020]',
              )}
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className={cn(isDialog && 'min-h-0 flex-1 overflow-y-auto')}>
          <TabsContent value="features" className={paneClass(isDialog)}>
            <FeaturesPane />
          </TabsContent>
          <TabsContent value="labels" className={paneClass(isDialog)}>
            <LabelListEditor />
          </TabsContent>
          <TabsContent value="prompts" className={paneClass(isDialog)}>
            <PromptsEditor />
          </TabsContent>
        </div>
      </Tabs>
    </AiSettingsLayoutContext.Provider>
  );
}

const paneClass = (isDialog: boolean) =>
  cn('mt-0 space-y-5 focus-visible:ring-0 focus-visible:ring-offset-0', isDialog ? 'p-5' : 'pt-5');

/* -------------------------------------------------------------------------- */
/*                                  Features                                  */
/* -------------------------------------------------------------------------- */

function FeaturesPane() {
  const { settings } = useAiSettings();
  return (
    <>
      <DisableAiCheckbox />
      {settings.disabled ? null : (
        <>
          <PlanStatus />
          <div className="space-y-3">
            <SectionHeader
              title="Background AI"
              description="Runs automatically on new mail as it arrives."
            />
            <FeatureToggles />
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5 shrink-0" />
            Mail you send, spam, promotions and social updates are never processed.
          </p>
        </>
      )}
    </>
  );
}

const DISABLED_FEATURES = [
  'Zero chat and voice',
  'AI compose and subject lines',
  'Smart search',
  'Thread summaries and sender research',
  'Auto labels and reply drafts on new mail',
  'MCP access for AI assistants',
];

/** Master switch: turns off every AI feature in the app and on the server. */
function DisableAiCheckbox() {
  const { settings, save, isLoading } = useAiSettings();
  const layout = useAiSettingsLayout();
  const navigate = useNavigate();
  const disabled = settings.disabled;

  const onChange = async (checked: boolean) => {
    try {
      await save({ disabled: checked });
    } catch {
      return;
    }
    if (!checked) {
      toast.success('AI features turned back on');
    } else if (layout === 'dialog') {
      // The dialog lives in the AI sidebar, which disappears with AI off.
      toast.success('AI features turned off', {
        description: 'Turn them back on any time in Settings → AI.',
        action: { label: 'Open settings', onClick: () => navigate('/settings/ai') },
      });
    } else {
      toast.success('AI features turned off');
    }
  };

  return (
    <div
      className={cn(
        surface,
        'p-4 transition-colors',
        disabled && 'border-[#F43F5E]/30 bg-[#F43F5E]/[0.04] dark:border-[#F43F5E]/30',
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id="ai-disabled"
          checked={disabled}
          disabled={isLoading}
          onCheckedChange={(checked) => onChange(checked === true)}
          className={cn(
            'mt-0.5 rounded-[4px] border-[#D4D4D4] dark:border-[#3A3A3A]',
            'data-[state=checked]:border-[#F43F5E] data-[state=checked]:bg-[#F43F5E] data-[state=checked]:text-white',
            '[&_svg]:size-3',
          )}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label htmlFor="ai-disabled" className="cursor-pointer text-sm font-medium">
            Disable AI
          </Label>
          <p className="text-muted-foreground text-[13px] leading-snug">
            {disabled
              ? 'All AI features are off. Zero won’t send your mail to any AI model.'
              : 'Turn off every AI feature in Zero. Your AI settings are kept for when you turn it back on.'}
          </p>
        </div>
      </div>
      {disabled && (
        <ul className="text-muted-foreground mt-3 grid gap-1.5 pl-7 text-[13px] sm:grid-cols-2">
          {DISABLED_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-1.5">
              <Ban className="size-3 shrink-0 text-[#F43F5E]/70" />
              {feature}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanStatus() {
  const { brainActivity, isLoading } = useBilling();
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-[72px] w-full rounded-xl" />;

  if (!brainActivity.enabled) {
    const exhausted = brainActivity.total > 0 && brainActivity.remaining <= 0;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.06] p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#8B5CF6] text-white">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium">
            {exhausted ? 'You’re out of AI runs' : 'Background AI is a Pro feature'}
          </p>
          <p className="text-muted-foreground text-[13px] leading-snug">
            {exhausted
              ? 'You have used all AI runs for this period.'
              : 'Get summaries, auto labels and reply drafts on new mail.'}
          </p>
        </div>
        <Button
          size="xs"
          className="h-8 shrink-0 rounded-lg bg-[#8B5CF6] px-3 text-[13px] text-white hover:bg-[#8B5CF6]/90"
          onClick={() => navigate('/pricing')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  const { usage, total, unlimited, interval } = brainActivity;
  const percent = total > 0 ? Math.min(100, Math.round((usage / total) * 100)) : 0;

  return (
    <div className={cn(surface, 'space-y-3 p-4')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-iconLight dark:text-iconDark size-4" />
          <p className="text-sm font-medium">AI runs</p>
        </div>
        <p className="text-muted-foreground text-[13px] tabular-nums">
          {unlimited ? (
            <span className="rounded-md bg-[#8B5CF6]/10 px-1.5 py-0.5 text-xs font-medium text-[#8B5CF6]">
              Unlimited
            </span>
          ) : (
            <>
              <span className="text-foreground font-medium">{usage}</span> / {total}
              {interval ? ` this ${interval}` : ''}
            </>
          )}
        </p>
      </div>
      {!unlimited && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E7E7E7] dark:bg-[#252525]">
          <div
            className={cn(
              'h-full rounded-full transition-[width]',
              percent >= 90 ? 'bg-[#F59E0D]' : 'bg-[#006FFE]',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  );
}

const FEATURES: {
  key: 'summaries' | 'autoLabels' | 'replyDrafts';
  title: string;
  body: string;
  icon: typeof Zap;
}[] = [
  {
    key: 'summaries',
    title: 'Thread summaries',
    body: 'Summarize new mail, and threads you open that have no summary yet.',
    icon: ListChecks,
  },
  {
    key: 'autoLabels',
    title: 'Auto labels',
    body: 'Apply labels from your auto-label list to new mail.',
    icon: Tag,
  },
  {
    key: 'replyDrafts',
    title: 'Reply drafts',
    body: 'Draft a reply to new mail that needs one. Drafts are saved, never sent.',
    icon: PenLine,
  },
];

function FeatureToggles() {
  const { settings, save, isLoading } = useAiSettings();
  return (
    <div className={cn(surface, 'divide-y divide-[#E7E7E7] dark:divide-[#252525]')}>
      {FEATURES.map(({ key, title, body, icon: Icon }) => (
        <div key={key} className="flex items-center gap-3 px-4 py-3">
          <IconTile>
            <Icon />
          </IconTile>
          <div className="min-w-0 flex-1 space-y-0.5">
            <Label htmlFor={`ai-${key}`} className="cursor-pointer text-sm font-medium">
              {title}
            </Label>
            <p className="text-muted-foreground text-[13px] leading-snug">{body}</p>
          </div>
          <Switch
            id={`ai-${key}`}
            disabled={isLoading}
            checked={settings[key]}
            onCheckedChange={(checked) => save({ [key]: checked }).catch(() => {})}
          />
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Auto labels                                */
/* -------------------------------------------------------------------------- */

const LABEL_MODES = [
  {
    value: 'learned',
    title: 'Learned from your inbox',
    body: 'Zero picks topics from your recent mail and creates matching labels.',
  },
  {
    value: 'custom',
    title: 'My own list',
    body: 'Only these labels are applied. Missing labels are created when first used.',
  },
] as const;

// Client-only row identity so removing a row doesn't shift DOM/focus onto its neighbour.
type LabelRow = AiLabel & { rowId: string };

const toRows = (source: readonly AiLabel[]): LabelRow[] =>
  source.map(({ name, usecase }) => ({ name, usecase, rowId: crypto.randomUUID() }));
const fromRows = (rows: readonly AiLabel[]): AiLabel[] =>
  rows.map(({ name, usecase }) => ({ name, usecase }));
const cloneDefaults = () => toRows(defaultLabels);

function LabelListEditor() {
  const { settings, save, isSaving } = useAiSettings();
  const storedMode = settings.labels ? 'custom' : 'learned';
  const storedKey = JSON.stringify(settings.labels ?? null);

  const [mode, setMode] = useState<'learned' | 'custom'>(storedMode);
  const [labels, setLabels] = useState<LabelRow[]>(() =>
    settings.labels ? toRows(settings.labels) : cloneDefaults(),
  );

  const resetToStored = () => {
    setMode(storedMode);
    setLabels(settings.labels ? toRows(settings.labels) : cloneDefaults());
  };

  // Re-sync only when the stored list changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(resetToStored, [storedKey]);

  const isDirty =
    mode !== storedMode ||
    (mode === 'custom' &&
      JSON.stringify(fromRows(labels)) !==
        JSON.stringify(settings.labels ? fromRows(settings.labels) : null));

  const update = (rowId: string, patch: Partial<AiLabel>) =>
    setLabels((current) =>
      current.map((label) => (label.rowId === rowId ? { ...label, ...patch } : label)),
    );

  const onSave = async () => {
    if (mode === 'learned') {
      await save({ labels: undefined }).catch(() => {});
      toast.success('Auto labels will use topics learned from your inbox');
      return;
    }
    const cleaned = labels
      .map((label) => ({ name: label.name.trim(), usecase: label.usecase.trim() }))
      .filter((label) => label.name);
    const parsed = aiSettingsSchema.shape.labels.safeParse(cleaned);
    if (!parsed.success || !cleaned.length) {
      toast.error(
        cleaned.length
          ? (parsed.error?.issues[0]?.message ?? 'Invalid label list')
          : 'Add at least one label',
      );
      return;
    }
    await save({ labels: parsed.data }).catch(() => {});
    toast.success('Auto-label list saved');
  };

  return (
    <>
      {!settings.autoLabels && (
        <div className={cn(surface, 'flex items-center justify-between gap-3 px-4 py-3')}>
          <p className="text-muted-foreground text-[13px] leading-snug">
            Auto labels are turned off. Your list is kept for when you turn them back on.
          </p>
          <Button
            variant="outline"
            className={cn(subtleButton, 'shrink-0')}
            onClick={() => save({ autoLabels: true }).catch(() => {})}
          >
            Turn on
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader title="Label source" description="Decide where auto labels come from." />
        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as 'learned' | 'custom')}
          className="grid gap-2 sm:grid-cols-2"
        >
          {LABEL_MODES.map((option) => (
            <label
              key={option.value}
              htmlFor={`ai-labels-${option.value}`}
              className={cn(
                surface,
                'flex cursor-pointer items-start gap-3 p-3.5 transition-colors',
                'hover:border-[#D4D4D4] dark:hover:border-[#333333]',
                'has-[[data-state=checked]]:border-[#006FFE] has-[[data-state=checked]]:bg-[#006FFE]/[0.04] dark:has-[[data-state=checked]]:border-[#006FFE]',
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={`ai-labels-${option.value}`}
                className="mt-0.5 border-[#D4D4D4] text-[#006FFE] data-[state=checked]:border-[#006FFE] dark:border-[#3A3A3A]"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="text-muted-foreground block text-[13px] leading-snug">
                  {option.body}
                </span>
              </span>
            </label>
          ))}
        </RadioGroup>
      </div>

      {mode === 'custom' && (
        <div className="space-y-3">
          <SectionHeader
            title="Labels"
            description="Describe when each label applies. Zero uses the description to decide."
            action={
              <span className="text-muted-foreground text-xs tabular-nums">
                {labels.length} / {MAX_AI_LABELS}
              </span>
            }
          />
          <div className={cn(surface, 'overflow-hidden')}>
            <div
              className={cn(
                'text-muted-foreground hidden grid-cols-[10rem_1fr_2rem] gap-2 border-b px-3 py-2 text-xs font-medium sm:grid',
                hairline,
              )}
            >
              <span>Name</span>
              <span>When to apply</span>
              <span className="sr-only">Actions</span>
            </div>
            {labels.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-[13px]">
                No labels yet. Add one to get started.
              </p>
            ) : (
              <div className="divide-y divide-[#E7E7E7] dark:divide-[#252525]">
                {labels.map((label) => (
                  <div
                    key={label.rowId}
                    className="group grid grid-cols-[1fr_2rem] items-start gap-2 px-3 py-2 sm:grid-cols-[10rem_1fr_2rem]"
                  >
                    <Input
                      aria-label="Label name"
                      placeholder="Label"
                      className={cn(field, 'h-8 px-2.5')}
                      maxLength={60}
                      value={label.name}
                      onChange={(event) => update(label.rowId, { name: event.target.value })}
                    />
                    <Textarea
                      aria-label="When to apply"
                      placeholder="When should this label be applied?"
                      className={cn(
                        field,
                        'col-start-1 row-start-2 min-h-8 resize-none px-2.5 py-1.5 sm:col-start-auto sm:row-start-auto',
                      )}
                      rows={1}
                      maxLength={300}
                      value={label.usecase}
                      onChange={(event) => update(label.rowId, { usecase: event.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${label.name || 'label'}`}
                      className="text-iconLight dark:text-iconDark size-8 rounded-lg hover:text-[#F43F5E] sm:opacity-60 sm:group-hover:opacity-100"
                      onClick={() =>
                        setLabels((current) => current.filter((row) => row.rowId !== label.rowId))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className={cn('flex items-center gap-2 border-t px-3 py-2', hairline)}>
              <Button
                variant="outline"
                className={subtleButton}
                disabled={labels.length >= MAX_AI_LABELS}
                onClick={() =>
                  setLabels((current) => [
                    ...current,
                    { name: '', usecase: '', rowId: crypto.randomUUID() },
                  ])
                }
              >
                <Plus className="size-3.5" /> Add label
              </Button>
              <Button
                variant="ghost"
                className="text-muted-foreground h-8 rounded-lg px-2.5 text-[13px] font-normal"
                onClick={() => setLabels(cloneDefaults())}
              >
                <RotateCcw className="size-3.5" /> Reset to defaults
              </Button>
            </div>
          </div>
        </div>
      )}

      <PaneFooter hint={isDirty ? 'You have unsaved changes' : undefined}>
        {isDirty && (
          <Button
            variant="ghost"
            className="h-8 rounded-lg px-3 text-[13px] font-normal"
            onClick={resetToStored}
            disabled={isSaving}
          >
            Discard
          </Button>
        )}
        <Button className={primaryButton} onClick={onSave} disabled={isSaving || !isDirty}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </Button>
      </PaneFooter>
    </>
  );
}
