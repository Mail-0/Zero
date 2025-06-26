import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Save, Users, ChevronDown, UserPlus, UserMinus } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Team name is required'),
});

const memberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['member', 'admin', 'owner']).default('member'),
});

interface TeamManagerProps {
  orgId: string | undefined;
}

interface Team {
  id: string;
  name: string;
  createdAt: string;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  teamId: string | null;
  name?: string | null;
  email?: string | null;
}

export function TeamManager({ orgId }: TeamManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const {
    register: registerMember,
    handleSubmit: handleMemberSubmit,
    reset: resetMember,
    setValue: setMemberValue,
    watch: watchMember,
    formState: { errors: memberErrors },
  } = useForm<z.infer<typeof memberSchema>>({ resolver: zodResolver(memberSchema) });

  async function fetchTeams() {
    if (!orgId) return;
    setLoading(true);
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/teams`);
    const data = (await res.json()) as { teams: Team[] };
    setTeams(data.teams || []);
    setLoading(false);
  }

  async function fetchMembers() {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members`);
    const data = (await res.json()) as { members: Member[] };
    setMembers(data.members || []);
  }

  useEffect(() => {
    fetchTeams();
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Team created');
      reset();
      fetchTeams();
    } else {
      toast.error('Failed to create team');
    }
  }

  async function onMemberSubmit(values: z.infer<typeof memberSchema>) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success('Member added');
      resetMember();
      fetchMembers();
    } else {
      toast.error('Failed to add member');
    }
  }

  async function deleteTeam(teamId: string) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/teams/${teamId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Team deleted');
      fetchTeams();
    } else {
      toast.error('Failed to delete team');
    }
  }

  async function assignMemberToTeam(memberId: string, teamId: string) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId }),
    });
    if (res.ok) {
      toast.success('Member assigned to team');
      fetchMembers();
    } else {
      toast.error('Failed to assign member');
    }
  }

  async function removeMemberFromTeam(memberId: string) {
    if (!orgId) return;
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: null }),
    });
    if (res.ok) {
      toast.success('Member removed from team');
      fetchMembers();
    } else {
      toast.error('Failed to remove member');
    }
  }

  function toggleTeamExpansion(teamId: string) {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  }

  function getTeamMembers(teamId: string) {
    return members.filter(m => m.teamId === teamId);
  }

  function getUnassignedMembers() {
    return members.filter(m => !m.teamId);
  }

  function EditableRow({ team }: { team: Team }) {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(team.name);

    async function save() {
      if (!name.trim() || name === team.name) {
        setEditing(false);
        return;
      }
      const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${orgId}/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success('Team updated');
        fetchTeams();
      } else {
        toast.error('Failed to update team');
      }
      setEditing(false);
    }

    const teamMembers = getTeamMembers(team.id);
    const isExpanded = expandedTeams.has(team.id);

    return (
      <Collapsible open={isExpanded} onOpenChange={() => toggleTeamExpansion(team.id)}>
        <div className="flex items-center gap-3 py-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="p-0 h-auto">
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          
          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
          ) : (
            <span className="flex-1">{team.name}</span>
          )}
          
          <Badge variant="secondary">{teamMembers.length} members</Badge>
          
          <div className="flex gap-2">
            {editing ? (
              <Button size="icon" variant="ghost" onClick={save} aria-label="Save">
                <Save className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" variant="ghost" onClick={() => setEditing(true)} aria-label="Edit">
                <Save className="h-4 w-4 opacity-0 group-hover:opacity-100" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => deleteTeam(team.id)} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <CollapsibleContent className="ml-6 mt-2 space-y-2">
          {teamMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-sm">
              <span>
                {member.name?.split(' ')[0] || member.email?.split('@')[0] || member.userId}
              </span>
              <Badge variant="outline">{member.role}</Badge>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6"
                onClick={() => removeMemberFromTeam(member.id)}
                aria-label="Remove from team"
              >
                <UserMinus className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {/* Add unassigned members to this team */}
          {getUnassignedMembers().map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-sm opacity-60">
              <span>
                {member.name?.split(' ')[0] || member.email?.split('@')[0] || member.userId}
              </span>
              <Badge variant="outline">{member.role}</Badge>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6"
                onClick={() => assignMemberToTeam(member.id, team.id)}
                aria-label="Add to team"
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Teams
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2">
            <Input placeholder="New team name" {...register('name')} />
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </form>
          {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}

          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="space-y-2">
              {teams.map((t) => (
                <EditableRow key={t.id} team={t} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
} 