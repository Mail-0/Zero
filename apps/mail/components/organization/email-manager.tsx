import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Mail, Trash2, Plus } from 'lucide-react';

const schema = z.object({
  connectionId: z.string().min(2, 'Connection ID required'),
  alias: z.string().optional(),
});

interface EmailManagerProps {
  orgId: string | undefined;
}

interface OrgEmail {
  id: string;
  email: string;
  alias: string | null;
  providerId: string;
}

export function EmailManager({ orgId }: EmailManagerProps) {
  const [emails, setEmails] = useState<OrgEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  async function fetchEmails() {
    if (!orgId) return;
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/emails`);
    const data = (await res.json()) as { emails: OrgEmail[] };
    setEmails(data.emails || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Email linked');
      reset();
      fetchEmails();
    } else {
      toast.error('Failed to link email');
    }
  }

  async function deleteEmail(id: string) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/emails/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Unlinked');
      fetchEmails();
    } else {
      toast.error('Failed to unlink email');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email Accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-3 gap-2">
          <Input placeholder="Connection ID" {...register('connectionId')} className="col-span-1" />
          <Input placeholder="Alias (optional)" {...register('alias')} className="col-span-1" />
          <Button type="submit" size="sm" className="col-span-1" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </form>
        {errors.connectionId && <p className="text-destructive text-sm">{errors.connectionId.message}</p>}
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ul className="space-y-2">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span>{e.email}</span>
                {e.alias && <span className="text-muted-foreground">({e.alias})</span>}
                <Button size="icon" variant="ghost" className="ml-auto" onClick={() => deleteEmail(e.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
} 