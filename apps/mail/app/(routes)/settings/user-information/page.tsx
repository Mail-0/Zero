import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsCard } from '@/components/settings/settings-card';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useCallback, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

const OCCUPATION_OPTIONS = [
  'Example Occupation1',
  'Example Occupation2',
  'Example Occupation3',
] as const;

const INITIAL_AFFILIATIONS = [
  'Example_Affiliation1',
  'Example_Affiliation2',
  'Example_Affiliation3',
];

const INITIAL_INTERESTS = ['Example_Interest1', 'Example_Interest2', 'Example_Interest3'];

interface StringListFieldProps {
  id: string;
  label: string;
  placeholder: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
}

function StringListField({ id, label, placeholder, items, onItemsChange }: StringListFieldProps) {
  const [inputValue, setInputValue] = useState('');

  const addItem = useCallback(() => {
    const value = inputValue.trim();
    if (!value) return;
    if (items.includes(value)) {
      setInputValue('');
      return;
    }
    onItemsChange([...items, value]);
    setInputValue('');
  }, [inputValue, items, onItemsChange]);

  const removeItem = useCallback(
    (item: string) => {
      onItemsChange(items.filter((entry) => entry !== item));
    },
    [items, onItemsChange],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItem();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="max-w-xl"
      />
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={item}
              variant="secondary"
              className="flex items-center gap-1 pr-1 font-normal"
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="hover:bg-accent rounded-full p-0.5"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserInformationPage() {
  const { data: session } = useSession();
  const [occupation, setOccupation] = useState<string>(OCCUPATION_OPTIONS[0]);
  const [affiliations, setAffiliations] = useState<string[]>(INITIAL_AFFILIATIONS);
  const [interests, setInterests] = useState<string[]>(INITIAL_INTERESTS);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // TODO_Doorman : Should connect save changes
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      toast.success(m['common.settings.saved']());
    } catch {
      toast.error(m['common.settings.failedToSave']());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsCard
      title={m['navigation.settings.userInformation']()}
      description={m['pages.settings.userInformation.description']()}
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? m['common.actions.saving']() : m['common.actions.saveChanges']()}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{m['pages.settings.userInformation.email']()}</p>
          <p className="text-muted-foreground text-sm">{session?.user?.email ?? '—'}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{m['pages.settings.userInformation.name']()}</p>
          <p className="text-muted-foreground text-sm">{session?.user?.name ?? '—'}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">Occupation</Label>
          <Select value={occupation} onValueChange={setOccupation}>
            <SelectTrigger id="occupation" className="max-w-xl">
              <SelectValue placeholder="Select occupation" />
            </SelectTrigger>
            <SelectContent>
              {OCCUPATION_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <StringListField
          id="affiliation"
          label="Affiliation"
          placeholder="Search to add affiliation"
          items={affiliations}
          onItemsChange={setAffiliations}
        />

        <StringListField
          id="interest"
          label="Interest"
          placeholder="Search to add Interest"
          items={interests}
          onItemsChange={setInterests}
        />
      </div>
    </SettingsCard>
  );
}
