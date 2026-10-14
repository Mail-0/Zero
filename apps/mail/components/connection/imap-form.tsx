import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTRPC } from '@/providers/query-provider';
import type { ImapPreset } from './imap-presets';
import { OutlookColor } from '../icons/icons';
import { m } from '@/paraglide/messages';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

type Security = 'tls' | 'starttls';

interface ServerFields {
  host: string;
  port: number;
  security: Security;
  username: string;
}

export interface ImapFormInitial {
  email: string;
  name?: string | null;
  imap: ServerFields;
  smtp: ServerFields;
  serverSavesSent?: boolean;
}

const emptyServer = (host: string, port: number, security: Security): ServerFields => ({
  host,
  port,
  security,
  username: '',
});

const oauthStartUrl = (provider: string, email: string) =>
  `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/imap-oauth/${provider}/start?email=${encodeURIComponent(email)}`;

function ServerSection({
  title,
  value,
  onChange,
  idPrefix,
}: {
  title: string;
  value: ServerFields;
  onChange: (value: ServerFields) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-xs font-medium">{title}</legend>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-host`} className="text-xs">
            {m['pages.settings.connections.imap.host']()}
          </Label>
          <Input
            id={`${idPrefix}-host`}
            value={value.host}
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...value, host: event.target.value.trim() })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-port`} className="text-xs">
            {m['pages.settings.connections.imap.port']()}
          </Label>
          <Input
            id={`${idPrefix}-port`}
            inputMode="numeric"
            value={String(value.port || '')}
            onChange={(event) =>
              onChange({ ...value, port: Number(event.target.value.replace(/\D/g, '')) || 0 })
            }
          />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-username`} className="text-xs">
            {m['pages.settings.connections.imap.username']()}
          </Label>
          <Input
            id={`${idPrefix}-username`}
            value={value.username}
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => onChange({ ...value, username: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{m['pages.settings.connections.imap.security']()}</Label>
          <Select
            value={value.security}
            onValueChange={(security) => onChange({ ...value, security: security as Security })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tls">{m['pages.settings.connections.imap.ssl']()}</SelectItem>
              <SelectItem value="starttls">
                {m['pages.settings.connections.imap.starttls']()}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}

export function ImapConnectionForm({
  initial,
  preset,
  onDone,
  onBack,
}: {
  /** Reconnect/edit mode: prefilled settings for an existing connection. */
  initial?: ImapFormInitial;
  /** Known provider (e.g. iCloud): its settings are used instead of autodiscovery. */
  preset?: ImapPreset;
  onDone?: (connectionId: string) => void;
  onBack?: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'account' | 'details'>(initial ? 'details' : 'account');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [password, setPassword] = useState('');
  const [imap, setImap] = useState<ServerFields>(initial?.imap ?? emptyServer('', 993, 'tls'));
  const [smtp, setSmtp] = useState<ServerFields>(initial?.smtp ?? emptyServer('', 465, 'tls'));
  const [serverSavesSent, setServerSavesSent] = useState(initial?.serverSavesSent ?? false);
  const [showAdvanced, setShowAdvanced] = useState(!!initial);
  const [discovering, setDiscovering] = useState(false);
  const [hint, setHint] = useState<{
    note?: string;
    helpUrl?: string;
    oauthProvider?: string;
    provider?: string;
  } | null>(null);

  const { mutateAsync: createConnection, isPending } = useMutation(
    trpc.connections.imap.create.mutationOptions(),
  );

  const applyPreset = (selected: ImapPreset) => {
    setImap({ ...selected.imap, username: email });
    setSmtp({ ...selected.smtp, username: email });
    setServerSavesSent(selected.serverSavesSent);
    setHint({ note: selected.note, helpUrl: selected.helpUrl, provider: selected.name });
    setShowAdvanced(false);
    setStep('details');
  };

  const discover = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (preset) return applyPreset(preset);
    setDiscovering(true);
    try {
      const result = await queryClient.fetchQuery(
        trpc.connections.imap.discover.queryOptions({ email }),
      );
      setImap(result.imap);
      setSmtp(result.smtp);
      setServerSavesSent(result.serverSavesSent);
      setHint({
        note: result.note,
        helpUrl: result.helpUrl,
        oauthProvider: result.oauthProvider,
        provider: result.provider,
      });
      // Guessed settings are often wrong; show them so the user can check.
      setShowAdvanced(result.source === 'guess');
    } catch {
      setImap({ ...emptyServer(`imap.${email.split('@')[1]}`, 993, 'tls'), username: email });
      setSmtp({ ...emptyServer(`smtp.${email.split('@')[1]}`, 465, 'tls'), username: email });
      setShowAdvanced(true);
    } finally {
      setDiscovering(false);
      setStep('details');
    }
  };

  const submit = async () => {
    try {
      const result = await createConnection({
        email,
        name: name || undefined,
        password,
        imap,
        smtp,
        serverSavesSent,
      });
      toast.success(m['pages.settings.connections.imap.success']());
      await queryClient.invalidateQueries({ queryKey: trpc.connections.list.queryKey() });
      onDone?.(result.id);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : m['pages.settings.connections.imap.error'](),
      );
    }
  };

  if (step === 'account') {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void discover();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="imap-email">{m['pages.settings.connections.imap.email']()}</Label>
          <Input
            id="imap-email"
            type="email"
            autoComplete="email"
            placeholder={preset?.placeholder}
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="imap-name">{m['pages.settings.connections.imap.name']()}</Label>
          <Input
            id="imap-name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex justify-between gap-2 pt-1">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              {m['pages.settings.connections.imap.back']()}
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={!email || discovering}>
            {discovering ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {m['pages.settings.connections.imap.detecting']()}
              </>
            ) : (
              m['pages.settings.connections.imap.continue']()
            )}
          </Button>
        </div>
      </form>
    );
  }

  const valid =
    !!password &&
    !!imap.host &&
    !!imap.port &&
    !!imap.username &&
    !!smtp.host &&
    !!smtp.port &&
    !!smtp.username;

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void submit();
      }}
    >
      <p className="text-muted-foreground text-sm">{email}</p>

      {hint?.oauthProvider === 'microsoft' && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            window.location.href = oauthStartUrl('microsoft', email);
          }}
        >
          <OutlookColor className="size-4" />
          {m['pages.settings.connections.imap.signInWith']({ provider: 'Microsoft' })}
        </Button>
      )}

      {hint?.note && (
        <p className="text-muted-foreground rounded-md border p-2 text-xs">
          {hint.note}{' '}
          {hint.helpUrl && (
            <a href={hint.helpUrl} target="_blank" rel="noreferrer" className="underline">
              {m['pages.settings.connections.imap.learnMore']()}
            </a>
          )}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="imap-password">{m['pages.settings.connections.imap.password']()}</Label>
        <Input
          id="imap-password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          {m['pages.settings.connections.imap.passwordHint']()}
        </p>
      </div>

      <button
        type="button"
        className="text-muted-foreground flex items-center gap-1 text-xs"
        onClick={() => setShowAdvanced((value) => !value)}
      >
        {showAdvanced ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {m['pages.settings.connections.imap.serverSettings']()}
      </button>

      <div className={cn('space-y-3', !showAdvanced && 'hidden')}>
        <ServerSection
          idPrefix="imap"
          title={m['pages.settings.connections.imap.incoming']()}
          value={imap}
          onChange={setImap}
        />
        <ServerSection
          idPrefix="smtp"
          title={m['pages.settings.connections.imap.outgoing']()}
          value={smtp}
          onChange={setSmtp}
        />
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={serverSavesSent}
            onChange={(event) => setServerSavesSent(event.target.checked)}
          />
          {m['pages.settings.connections.imap.serverSavesSent']()}
        </label>
      </div>

      <div className="flex justify-between gap-2 pt-1">
        {!initial ? (
          <Button type="button" variant="ghost" onClick={() => setStep('account')}>
            {m['pages.settings.connections.imap.back']()}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={!valid || isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {m['pages.settings.connections.imap.connecting']()}
            </>
          ) : (
            m['pages.settings.connections.imap.connect']()
          )}
        </Button>
      </div>
    </form>
  );
}
