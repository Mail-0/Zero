import { Building2, User, DollarSign, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface SimpleCRMData {
  company?: {
    name: string;
    industry: string;
    size: string;
  };
  contact?: {
    name: string;
    role: string;
    email: string;
  };
  deal?: {
    stage: string;
    value: string;
    closeDate: string;
  };
  lastActivity?: {
    type: string;
    date: string;
  };
}

interface SimpleCRMProps {
  data?: SimpleCRMData;
  isConnected?: boolean;
  source?: 'hubspot' | 'salesforce';
}

export function SimpleCRM({ data, isConnected = false, source = 'hubspot' }: SimpleCRMProps) {
  const getSourceColor = () => {
    return source === 'hubspot'
      ? 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800'
      : 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800';
  };

  const getSourceIcon = () => {
    return source === 'hubspot' ? (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M18.164 7.931V4.5a4.5 4.5 0 0 0-9 0v3.431a3.5 3.5 0 1 0 0 6.138V17.5a4.5 4.5 0 0 0 9 0v-3.431a3.5 3.5 0 1 0 0-6.138zM12 2.25a2.25 2.25 0 0 1 2.25 2.25v1.181a3.496 3.496 0 0 0-4.5 0V4.5A2.25 2.25 0 0 1 12 2.25zM5.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 7.25a2.25 2.25 0 0 1-2.25-2.25v-1.181a3.496 3.496 0 0 0 4.5 0V17.5a2.25 2.25 0 0 1-2.25 2.25zM18.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
          fill="#ff7a59"
        />
      </svg>
    ) : (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M12.017 8.928c-.304-.176-.685-.176-.989 0L8.3 10.312c-.304.176-.494.501-.494.854v2.768c0 .353.19.678.494.854l2.728 1.384c.304.176.685.176.989 0l2.728-1.384c.304-.176.494-.501.494-.854v-2.768c0-.353-.19-.678-.494-.854l-2.728-1.384z"
          fill="#00a1e0"
        />
        <path
          d="M17.5 6.5c-1.933 0-3.5 1.567-3.5 3.5 0 .827.287 1.587.768 2.184L12.017 13.5 9.268 12.184C9.713 11.587 10 10.827 10 10c0-1.933-1.567-3.5-3.5-3.5S3 8.067 3 10s1.567 3.5 3.5 3.5c.827 0 1.587-.287 2.184-.768L12.017 14l3.232-1.268c-.481.597-.768 1.357-.768 2.184 0 1.933 1.567 3.5 3.5 3.5s3.5-1.567 3.5-3.5-1.567-3.5-3.5-3.5z"
          fill="#00a1e0"
        />
      </svg>
    );
  };

  if (!isConnected) {
    return (
      <div className="bg-muted/30 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSourceIcon()}
            <span className="text-sm font-medium capitalize">{source} not connected</span>
          </div>
          <Button size="sm" variant="outline">
            Connect
          </Button>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Connect your {source} to see customer context and deal information
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`rounded-lg border p-4 ${getSourceColor()}`}>
        <div className="mb-3 flex items-center gap-2">
          {getSourceIcon()}
          <span className="text-sm font-medium capitalize">{source} Connected</span>
          <Badge variant="secondary" className="text-xs">
            No data
          </Badge>
        </div>
        <p className="text-muted-foreground text-xs">No CRM data found for this contact</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 ${getSourceColor()}`}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        {getSourceIcon()}
        <span className="text-sm font-medium capitalize">{source}</span>
        <Badge variant="secondary" className="text-xs">
          Connected
        </Badge>
      </div>

      {/* Company Info */}
      {data.company && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-3 w-3" />
            <span className="text-sm font-medium">{data.company.name}</span>
          </div>
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <div>{data.company.industry}</div>
            <div>{data.company.size}</div>
          </div>
        </div>
      )}

      {/* Contact Info */}
      {data.contact && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <User className="h-3 w-3" />
            <span className="text-sm font-medium">{data.contact.name}</span>
          </div>
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <div>{data.contact.role}</div>
            <div>{data.contact.email}</div>
          </div>
        </div>
      )}

      {/* Deal Info */}
      {data.deal && (
        <div className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <DollarSign className="h-3 w-3" />
            <span className="text-sm font-medium">{data.deal.value}</span>
            <Badge variant="outline" className="text-xs">
              {data.deal.stage}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs">Close date: {data.deal.closeDate}</div>
        </div>
      )}

      {/* Last Activity */}
      {data.lastActivity && (
        <div className="border-t pt-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3" />
            <span className="text-muted-foreground text-xs">
              Last {data.lastActivity.type}: {data.lastActivity.date}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Sample data for demo purposes
export const sampleCRMData: SimpleCRMData = {
  company: {
    name: 'TechCorp Inc.',
    industry: 'Software',
    size: '500-1000 employees',
  },
  contact: {
    name: 'Sarah Chen',
    role: 'VP of Sales',
    email: 'sarah.chen@techcorp.com',
  },
  deal: {
    stage: 'Proposal',
    value: '$50,000',
    closeDate: 'Mar 30, 2024',
  },
  lastActivity: {
    type: 'email',
    date: 'Mar 15, 2024',
  },
};
