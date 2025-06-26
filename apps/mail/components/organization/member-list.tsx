import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Users, Trash2, LogOut } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth-client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface MemberListProps {
  orgId: string | undefined;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  teamId: string | null;
  name?: string | null;
  email?: string | null;
}

export function MemberList({ orgId }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const { data: session } = useSession();

  async function fetchMembers() {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members`, {
        credentials: 'include',
      });
      const data = (await res.json()) as { members: Member[] };
      setMembers(data.members || []);
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(memberId: string, isSelf: boolean) {
    if (!orgId) return;
    setRemoving(memberId);
    try {
      let res: Response;
      if (isSelf) {
        if (members.length === 1) {
          // last member, delete org
          res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } else {
          res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/leave`, {
            method: 'POST',
            credentials: 'include',
          });
        }
      } else {
        res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members/${memberId}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }
      
      if (res.ok) {
        if (isSelf && members.length === 1) {
          toast.success('Organization deleted successfully');
        } else if (isSelf) {
          toast.success('Left organization successfully');
        } else {
          toast.success('Member removed successfully');
        }
        fetchMembers();
      } else {
        const err = (await res.json()) as any;
        toast.error(err?.error || 'Failed to remove member');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemoving(null);
      setDialogOpen(null);
    }
  }

  useEffect(() => {
    fetchMembers();
  }, [orgId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> Members
        </CardTitle>
        <CardDescription>All members of this organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const isSelf = session?.user?.id === m.userId;
              const selfRole = members.find((x) => x.userId === session?.user?.id)?.role;
              const canRemove = isSelf || selfRole === 'owner' || (selfRole === 'admin' && m.role === 'member');
              const isLastMember = members.length === 1;
              
              return (
                <li key={m.id} className="flex items-center gap-2">
                  <span className="break-all flex-1">
                    {m.name?.split(' ')[0] || m.email?.split('@')[0] || m.userId}
                  </span>
                  <Badge variant="outline">{m.role}</Badge>
                  {canRemove && (
                    <Dialog open={dialogOpen === m.id} onOpenChange={(open) => setDialogOpen(open ? m.id : null)}>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={removing === m.id}
                          aria-label={isSelf ? 'Leave' : 'Remove'}
                        >
                          {removing === m.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isSelf ? (
                            <LogOut className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent showOverlay={true}>
                        <DialogHeader>
                          <DialogTitle>
                            {isSelf && isLastMember
                              ? 'Delete Organization'
                              : isSelf
                              ? 'Leave Organization'
                              : 'Remove Member'}
                          </DialogTitle>
                          <DialogDescription>
                            {isSelf && isLastMember
                              ? 'You are the last member. This will permanently delete the organization and cannot be undone.'
                              : isSelf
                              ? 'Are you sure you want to leave this organization?'
                              : `Are you sure you want to remove ${m.name?.split(' ')[0] || m.email?.split('@')[0] || 'this member'} from the organization?`}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setDialogOpen(null)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => removeMember(m.id, isSelf)}
                            disabled={removing === m.id}
                          >
                            {removing === m.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {isSelf && isLastMember ? 'Deleting...' : isSelf ? 'Leaving...' : 'Removing...'}
                              </>
                            ) : (
                              <>
                                {isSelf && isLastMember
                                  ? 'Delete Organization'
                                  : isSelf
                                  ? 'Leave'
                                  : 'Remove'}
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
} 