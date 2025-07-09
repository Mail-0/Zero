import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';

interface Invitation {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  status: string;
  organization?: { name?: string };
}

export function ReceivedInvites() {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  async function fetchInvites() {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations?status=pending`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { invitations: Invitation[] };
      const myEmail = session?.user?.email;
      const filtered = data.invitations.filter((inv) => inv.email === myEmail);
      setInvites(filtered);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.email) fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  async function respond(id: string, accept: boolean) {
    try {
      const endpoint = `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations/${id}/${accept ? 'accept' : 'decline'}`;
      const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
      if (res.ok) {
        toast.success(`Invitation ${accept ? 'accepted' : 'declined'}`);
        fetchInvites();
      } else {
        const err = (await res.json()) as any;
        toast.error(err?.error || 'Failed');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  if (!session?.user?.email) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" /> Pending Invitations
        </CardTitle>
        <CardDescription>Your outstanding organization invites</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex flex-col">
                <span className="font-medium">{inv.organizationId}</span>
                <span className="text-sm text-muted-foreground">Role: {inv.role}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => respond(inv.id, true)}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => respond(inv.id, false)}>
                  Decline
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
} 