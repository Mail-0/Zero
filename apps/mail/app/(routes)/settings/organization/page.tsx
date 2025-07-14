import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsEditor } from '@/components/organization/settings-editor';
import { Building2, Loader2, Mail, UserPlus, Users } from 'lucide-react';
import { TeamManager } from '@/components/organization/team-manager';
import { MemberList } from '@/components/organization/member-list';
import { SettingsCard } from '@/components/settings/settings-card';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Role = 'member' | 'admin' | 'owner';

type Domain = {
  domain: string;
  verified: boolean;
  verificationToken: string | null;
};

export default function OrganizationPage() {
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgDomain, setOrgDomain] = useState('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrg, setActiveOrg] = useState<any>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [newDomain, setNewDomain] = useState('');
  // Invitations state
  const [invites, setInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [domainVerificationToken, setDomainVerificationToken] = useState<string | null>(null);
  const [domainVerified, setDomainVerified] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const trpc = useTRPC();

  // TRPC queries
  const { data: domainsData, refetch: refetchDomains } = useQuery({
    ...trpc.organization.listDomains.queryOptions({ organizationId: activeOrg?.id || '' }),
    enabled: !!activeOrg?.id,
  });

  // TRPC mutations
  const verifyDomainMutation = useMutation(trpc.organization.verifyDomain.mutationOptions());
  const addDomainMutation = useMutation(trpc.organization.addDomain.mutationOptions());
  const removeDomainMutation = useMutation(trpc.organization.removeDomain.mutationOptions());
  const verifyDomainForOrgMutation = useMutation(
    trpc.organization.verifyDomainForOrg.mutationOptions(),
  );

  // Update domains when data changes
  useEffect(() => {
    if (domainsData?.domains) {
      setDomains(
        domainsData.domains.map((d) => ({
          ...d,
          verificationToken: d.verificationToken || null,
        })),
      );
    }
  }, [domainsData]);

  // Test organization creation
  const handleCreateOrganization = async () => {
    if (!orgName || !orgSlug || !orgDomain || !domainVerified) {
      toast.error('Please fill in all fields and verify your domain');
      return;
    }
    setCreatingOrg(true);
    try {
      await authClient.organization.create({
        name: orgName,
        slug: orgSlug,
      });
      toast.success(`Organization "${orgName}" created successfully!`);
      setOrgName('');
      setOrgSlug('');
      setOrgDomain('');
      setDomainVerificationToken(null);
      setDomainVerified(false);
      setVerifyMsg(null);
      setVerificationToken(null);
      // Refresh organizations list
      const orgs = await authClient.organization.list();
      setOrganizations(orgs.data || []);
    } catch (error: any) {
      toast.error(`Failed to create organization: ${error.message}`);
    } finally {
      setCreatingOrg(false);
    }
  };

  // Test member invitation
  const handleInviteMember = async () => {
    if (!inviteEmail || !activeOrg) {
      toast.error('Please enter an email and select an organization');
      return;
    }

    setLoading(true);
    try {
      await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole,
        organizationId: activeOrg.id,
      });

      toast.success(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail('');
    } catch (error: any) {
      toast.error(`Failed to send invitation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Test setting active organization
  const handleSetActiveOrg = async (org: any) => {
    setLoading(true);
    try {
      await authClient.organization.setActive({
        organizationId: org.id,
      });

      setActiveOrg(org);
      toast.success(`Active organization set to "${org.name}"`);
    } catch (error: any) {
      toast.error(`Failed to set active organization: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  async function addDomain(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newDomain || !activeOrg?.id) return;

    try {
      await addDomainMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain: newDomain,
      });
      setNewDomain('');
      refetchDomains();
      toast.success('Domain added successfully');
    } catch (error: any) {
      toast.error('Failed to add domain');
    }
  }

  async function removeDomain(domain: string) {
    if (!activeOrg?.id) return;

    try {
      await removeDomainMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain,
      });
      refetchDomains();
      toast.success('Domain removed successfully');
    } catch (error: any) {
      toast.error('Failed to remove domain');
    }
  }

  async function verifyDomain(domain: string) {
    if (!activeOrg?.id) return;
    setVerifying(true);
    setVerifyMsg(null);

    try {
      const result = await verifyDomainForOrgMutation.mutateAsync({
        organizationId: activeOrg.id,
        domain,
      });

      if ('verified' in result && result.verified) {
        setVerifyMsg('Domain verified!');
        refetchDomains();
      } else if ('message' in result && result.message) {
        setVerifyMsg(result.message);
      } else if ('error' in result && result.error) {
        setVerifyMsg(result.error);
      } else {
        setVerifyMsg('Verification failed');
      }
    } catch (error: any) {
      setVerifyMsg('Verification failed');
    } finally {
      setVerifying(false);
    }
  }

  // Fetch pending invitations - TODO: Convert to TRPC when invitation router is available
  async function fetchInvites() {
    if (!activeOrg?.id) return;
    setLoadingInvites(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations?organizationId=${activeOrg.id}&status=pending`,
        { credentials: 'include' },
      );
      const data = (await res.json()) as { invitations: any[] };
      setInvites(data.invitations || []);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoadingInvites(false);
    }
  }

  // Cancel an invitation - TODO: Convert to TRPC when invitation router is available
  async function cancelInvite(inviteId: string) {
    if (!inviteId) return;
    try {
      await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/invitations/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast.success('Invitation cancelled');
      fetchInvites();
    } catch (error: any) {
      toast.error(`Failed to cancel invite: ${error.message}`);
    }
  }

  // Fetch invitations when org changes
  useEffect(() => {
    if (activeOrg?.id) fetchInvites();
  }, [activeOrg?.id]);

  // Load organizations on mount
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        const orgs = await authClient.organization.list();
        setOrganizations(orgs.data || []);

        // Set first org as active if available
        if (orgs.data && orgs.data.length > 0) {
          setActiveOrg(orgs.data[0]);
        }
      } catch (error) {
        console.error('Failed to load organizations:', error);
      }
    };

    loadOrganizations();
  }, []);

  // Check domain verification and slug availability
  const handleAddDomain = async () => {
    if (!orgName || !orgSlug || !orgDomain) {
      toast.error('Please fill in organization name, slug, and domain');
      return;
    }
    setVerifying(true);
    setVerifyMsg(null);

    try {
      // Check if slug is available
      const orgs = await authClient.organization.list();
      const slugExists = orgs.data?.some((org) => org.slug === orgSlug);
      if (slugExists) {
        toast.error('Organization slug already exists. Please choose a different one.');
        setVerifying(false);
        return;
      }

      // Check domain verification directly
      const result = await verifyDomainMutation.mutateAsync({
        domain: orgDomain,
        verificationToken: verificationToken ?? undefined,
      });

      // Store the verification token for reuse
      if (result.verificationToken) {
        setVerificationToken(result.verificationToken);
      }

      if (result.verified) {
        setDomainVerified(true);
        setVerifyMsg('Domain verified! You can now create your organization.');
      } else {
        setVerifyMsg(
          result.message || 'Domain verification failed. Please add the TXT record to your DNS.',
        );
      }
    } catch (error: any) {
      toast.error(`Failed to verify domain: ${error.message}`);
    } finally {
      setVerifying(false);
    }
  };

  // DEBUG BYPASS VERIFICATION
  const handleDebugBypass = () => {
    setDomainVerified(true);
    toast.success('DEBUG: Domain verification bypassed!');
  };

  return (
    <div className="grid gap-6">
      <SettingsCard
        title="Organizations"
        // description="Test organization creation, member invites, and management functionality"
      >
        <div className="space-y-6">
          <Tabs defaultValue={organizations.length > 0 ? 'my-organizations' : 'create'}>
            <TabsList>
              {organizations.length > 0 && (
                <>
                  <TabsTrigger value="my-organizations">My Organizations</TabsTrigger>
                  <TabsTrigger value="invite">Invite Member</TabsTrigger>
                  <TabsTrigger value="pending">Pending Invitations</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                  <TabsTrigger value="team">Team</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </>
              )}
              <TabsTrigger value="create">Create Organization</TabsTrigger>
              <TabsTrigger value="results">Test Results</TabsTrigger>
            </TabsList>

            <TabsContent value="my-organizations">
              {organizations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Your Organizations
                    </CardTitle>
                    <CardDescription>Select an organization to manage members</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {organizations.map((org) => (
                        <div
                          key={org.id}
                          className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors ${
                            activeOrg?.id === org.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-accent'
                          }`}
                          onClick={() => handleSetActiveOrg(org)}
                        >
                          <div className="flex items-center gap-3">
                            {org.logo && (
                              <img
                                src={org.logo}
                                alt={`${org.name} logo`}
                                className="h-6 w-6 rounded"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                            <div>
                              <p className="font-medium">{org.name}</p>
                              <p className="text-muted-foreground text-sm">@{org.slug}</p>
                            </div>
                            {activeOrg?.id === org.id && <Badge variant="secondary">Active</Badge>}
                          </div>
                          <Badge variant="outline">{org.member?.role || 'Unknown'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="create">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Create Organization
                  </CardTitle>
                  <CardDescription>
                    Create a new organization. You must verify your domain before proceeding.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="My Organization"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-slug">Organization Slug</Label>
                      <Input
                        id="org-slug"
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        placeholder="my-org"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-domain">Organization Domain</Label>
                      <Input
                        id="org-domain"
                        value={orgDomain}
                        onChange={(e) => setOrgDomain(e.target.value)}
                        placeholder="example.com"
                      />
                      <Button
                        onClick={handleAddDomain}
                        disabled={!orgName || !orgSlug || !orgDomain || verifying}
                        className="mt-2 w-full"
                        type="button"
                      >
                        {verifying ? 'Checking...' : 'Verify Domain & Check Slug'}
                      </Button>
                    </div>
                  </div>
                  {verifyMsg && (
                    <div className="bg-muted mt-4 rounded border p-4">
                      <div className="text-sm text-blue-600">{verifyMsg}</div>
                      {verificationToken && !domainVerified && (
                        <div className="mt-2">
                          <div className="mb-2 text-sm">Add this TXT record to your DNS:</div>
                          <code className="mb-2 block rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-900">
                            zero-verification={verificationToken}
                          </code>
                          <Button
                            onClick={handleAddDomain}
                            disabled={verifying}
                            size="sm"
                            type="button"
                          >
                            {verifying ? 'Checking...' : 'Retry Verification'}
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        onClick={handleDebugBypass}
                        style={{ marginLeft: 8 }}
                      >
                        DEBUG: Bypass Verification
                      </Button>
                    </div>
                  )}
                  <Button
                    onClick={handleCreateOrganization}
                    disabled={creatingOrg || !orgName || !orgSlug || !orgDomain || !domainVerified}
                    className="w-full"
                    type="button"
                  >
                    {creatingOrg ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="invite">
              {activeOrg && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Invite Member
                    </CardTitle>
                    <CardDescription>Invite a new member to "{activeOrg.name}"</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="member@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="invite-role">Role</Label>
                        <Select
                          value={inviteRole}
                          onValueChange={(value: Role) => setInviteRole(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={handleInviteMember}
                      disabled={loading || !inviteEmail}
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending Invite...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="pending">
              {activeOrg && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Pending Invitations
                    </CardTitle>
                    <CardDescription>
                      Manage outgoing invitations for "{activeOrg.name}"
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {loadingInvites ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : invites.length > 0 ? (
                      invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors"
                        >
                          <div>
                            <p className="font-medium">{invite.email}</p>
                            <p className="text-muted-foreground text-sm">{invite.role}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelInvite(invite.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No pending invitations.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="members">
              {activeOrg && <MemberList orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="team">
              {activeOrg && <TeamManager orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="settings">
              {activeOrg && <SettingsEditor orgId={activeOrg.id} />}
            </TabsContent>

            <TabsContent value="results">
              <Card>
                <CardHeader>
                  <CardTitle>Test Results</CardTitle>
                  <CardDescription>
                    Check the console and toast notifications for test results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p>
                      • Organization creation: Check if the organization appears in the list above
                    </p>
                    <p>• Member invitations: Check your email for invitation links</p>
                    <p>• Active organization: The selected organization will be highlighted</p>
                    <p>• Backend logs: Check server logs for invitation email sending</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SettingsCard>
    </div>
  );
}
