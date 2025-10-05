import { Building2, User, ExternalLink, Mail } from 'lucide-react';
import type { FakeEmail } from '@/lib/fake-organised-data';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

interface CustomerCompanyPanelProps {
  email: FakeEmail | null;
}

export function CustomerCompanyPanel({ email }: CustomerCompanyPanelProps) {
  console.log('CustomerCompanyPanel received email:', email);

  if (!email) {
    return (
      <div className="flex h-full w-full flex-col p-4">
        <div className="text-muted-foreground flex h-full items-center justify-center text-center text-sm">
          Select an email to view customer & company details
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-none flex h-full w-full flex-col gap-4 overflow-y-auto p-0">
      {/* Customer Section */}
      <Card className="border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <User className="text-primary h-5 w-5" />
          <h3 className="text-foreground font-semibold">Customer</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Name</p>
            <p className="text-foreground text-sm font-medium">{email.customer.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Role</p>
            <p className="text-foreground text-sm">{email.customer.role}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">LinkedIn</p>
            <a
              href={email.customer.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm transition-colors"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Previous Emails</p>
            <div className="flex items-center gap-2">
              <Mail className="text-muted-foreground h-4 w-4" />
              <p className="text-foreground text-sm font-medium">{email.customer.previousEmails}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Company Section */}
      <Card className="border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="text-primary h-5 w-5" />
          <h3 className="text-foreground font-semibold">Company</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Name</p>
            <p className="text-foreground text-sm font-medium">{email.company.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Size</p>
            <Badge variant="secondary" className="text-xs">
              {email.company.size}
            </Badge>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Industry</p>
            <p className="text-foreground text-sm">{email.company.industry}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">Recent News</p>
            <p className="text-foreground text-sm leading-relaxed">{email.company.recentNews}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
