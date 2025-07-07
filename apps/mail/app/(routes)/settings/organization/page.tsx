import { useState, useEffect } from 'react';
import { SettingsCard } from '@/components/settings/settings-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { toast } from 'sonner';
import { Loader2, Users, UserPlus, Building2, Mail } from 'lucide-react';

type Role = 'member' | 'admin' | 'owner';

type Domain = {
  domain: string;
  verified: boolean;
  verificationToken: string;
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
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [domainVerificationToken, setDomainVerificationToken] = useState<string | null>(null);
  const [domainVerified, setDomainVerified] = useState(false);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Test organization creation
  const handleCreateOrganization = async () => {
    if (!orgName || !orgSlug || !orgDomain || !domainVerified) {
      toast.error('Please fill in all fields and verify your domain');
      return;
    }
    setCreatingOrg(true);
    try {
      const result = await authClient.organization.create({
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

  // Fetch domains for the active org
  async function fetchDomains() {
    setLoadingDomains(true);
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${activeOrg?.id}/domains`);
    const data = (await res.json()) as { domains: Domain[] };
    setDomains(data.domains || []);
    setLoadingDomains(false);
  }

  async function addDomain(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!newDomain) return;
    await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${activeOrg?.id}/domains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: newDomain }),
    });
    setNewDomain('');
    fetchDomains();
  }

  async function removeDomain(domain: string) {
    await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${activeOrg?.id}/domains`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    fetchDomains();
  }

  async function verifyDomain(domain: string) {
    setVerifying(true);
    setVerifyMsg(null);
    const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/${activeOrg?.id}/domains/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    const data = (await res.json()) as { verified: boolean; message?: string; error?: string };
    if (data.verified) {
      setVerifyMsg('Domain verified!');
      fetchDomains();
    } else {
      setVerifyMsg(data.message || data.error || 'Verification failed');
    }
    setVerifying(false);
  }

  // Fetch domains when org changes
  useEffect(() => {
    if (activeOrg?.id) fetchDomains();
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
      const slugExists = orgs.data?.some(org => org.slug === orgSlug);
      if (slugExists) {
        toast.error('Organization slug already exists. Please choose a different one.');
        return;
      }
      
      // Check domain verification directly
      const res = await fetch(`${import.meta.env.VITE_PUBLIC_BACKEND_URL}/api/organization/verify-domain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: orgDomain,
          verificationToken: verificationToken 
        }),
      });
      const data = (await res.json()) as { 
        verified: boolean; 
        message?: string; 
        error?: string;
        verificationToken?: string;
      };
      
      // Store the verification token for reuse
      if (data.verificationToken) {
        setVerificationToken(data.verificationToken);
      }
      
      if (data.verified) {
        setDomainVerified(true);
        setVerifyMsg('Domain verified! You can now create your organization.');
      } else {
        setVerifyMsg(data.message || data.error || 'Domain verification failed. Please add the TXT record to your DNS.');
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
        title="Organization Testing"
        description="Test organization creation, member invites, and management functionality"
      >
        <div className="space-y-6">
          {/* Organization Creation */}
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
                <div className="mt-4 p-4 border rounded bg-muted">
                  <div className="text-sm text-blue-600">{verifyMsg}</div>
                  {verificationToken && !domainVerified && (
                    <div className="mt-2">
                      <div className="mb-2 text-sm">Add this TXT record to your DNS:</div>
                      <code className="block bg-gray-100 dark:bg-gray-900 rounded px-2 py-1 mb-2 text-xs">
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
                  <Button variant="outline" onClick={handleDebugBypass} style={{ marginLeft: 8 }}>
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

          {/* Organizations List */}
          {organizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Organizations
                </CardTitle>
                <CardDescription>
                  Select an organization to manage members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        activeOrg?.id === org.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent'
                      }`}
                      onClick={() => handleSetActiveOrg(org)}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-sm text-muted-foreground">@{org.slug}</p>
                        </div>
                        {activeOrg?.id === org.id && (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </div>
                      <Badge variant="outline">{org.member?.role || 'Unknown'}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Member Invitation */}
          {activeOrg && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Invite Member
                </CardTitle>
                <CardDescription>
                  Invite a new member to "{activeOrg.name}"
                </CardDescription>
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
                    <Select value={inviteRole} onValueChange={(value: Role) => setInviteRole(value)}>
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

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Check the console and toast notifications for test results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>• Organization creation: Check if the organization appears in the list above</p>
                <p>• Member invitations: Check your email for invitation links</p>
                <p>• Active organization: The selected organization will be highlighted</p>
                <p>• Backend logs: Check server logs for invitation email sending</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SettingsCard>
    </div>
  );
} 