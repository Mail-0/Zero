import { SettingsCard } from '@/components/settings/settings-card';
import { useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { X } from 'lucide-react';
import { m } from '@/paraglide/messages';
import { toast } from 'sonner';

interface StringListFieldProps {
  id: string;
  label: string;
  placeholder: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  disabled?: boolean;
}

function StringListField({
  id,
  label,
  placeholder,
  items,
  onItemsChange,
  disabled = false,
}: StringListFieldProps) {
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
        disabled={disabled}
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
                disabled={disabled}
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
  const trpc = useTRPC();
  const [occupation, setOccupation] = useState('');
  const [affiliations, setAffiliations] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const profileQuery = useQuery(
    trpc.user.getProfile.queryOptions(undefined, {
      enabled: !!session?.user?.id,
    }),
  );

  const { mutateAsync: saveProfile } = useMutation(trpc.user.saveProfile.mutationOptions());

  useEffect(() => {
    if (!profileQuery.data) return;

    setOccupation(profileQuery.data.occupation);
    setAffiliations(profileQuery.data.affiliation);
    setInterests(profileQuery.data.interest);
  }, [profileQuery.data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile({
        occupation,
        affiliation: affiliations,
        interest: interests,
      });
      await profileQuery.refetch();
      toast.success(m['common.settings.saved']());
    } catch {
      toast.error(m['common.settings.failedToSave']());
    } finally {
      setIsSaving(false);
    }
  };

  const isLoading = profileQuery.isLoading;
  const isDisabled = isLoading || isSaving;

  return (
    <SettingsCard
      title={m['navigation.settings.userInformation']()}
      description={m['pages.settings.userInformation.description']()}
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={handleSave} disabled={isDisabled}>
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
          <p className="text-muted-foreground text-sm">
            {profileQuery.data?.name || session?.user?.name || '—'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="occupation">Occupation</Label>
          <Input
            id="occupation"
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
            placeholder="Enter your occupation"
            className="max-w-xl"
            disabled={isDisabled}
          />
        </div>

        <StringListField
          id="affiliation"
          label="Affiliation"
          placeholder="Search to add affiliation"
          items={affiliations}
          onItemsChange={setAffiliations}
          disabled={isDisabled}
        />

        <StringListField
          id="interest"
          label="Interest"
          placeholder="Search to add Interest"
          items={interests}
          onItemsChange={setInterests}
          disabled={isDisabled}
        />
      </div>
    </SettingsCard>
  );
}
