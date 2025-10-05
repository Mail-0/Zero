import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Deal status color mapping
const getDealStatusColor = (status: string) => {
  switch (status) {
    case 'Lead':
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200';
    case 'Qualified':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
    case 'Proposal':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-200';
    case 'Negotiation':
      return 'bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-200';
    case 'Closed Won':
      return 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200';
    case 'Closed Lost':
      return 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200';
  }
};

// Next step action color mapping
const getNextStepColor = (action: string) => {
  switch (action.toLowerCase()) {
    case 'follow up':
      return 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200';
    case 'call':
    case 'schedule call':
      return 'bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900 dark:text-purple-200';
    case 'send email':
    case 'email':
      return 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-900 dark:text-cyan-200';
    case 'meeting':
    case 'schedule meeting':
      return 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900 dark:text-indigo-200';
    case 'send proposal':
    case 'proposal':
      return 'bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-900 dark:text-violet-200';
    case 'send contract':
    case 'contract':
      return 'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200';
    case 'onboarding':
      return 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-900 dark:text-teal-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200';
  }
};

interface NextStep {
  action: string;
  date?: string;
}

interface CRMContact {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  dealStatus: string;
  lastContact: string;
  nextSteps: NextStep;
  notes: string;
}

const sampleContacts: CRMContact[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah@techcorp.com',
    company: 'TechCorp Inc.',
    role: 'VP of Sales',
    dealStatus: 'Proposal',
    lastContact: '2024-03-15',
    nextSteps: { action: 'Schedule Call', date: '2024-03-25' },
    notes: 'Interested in enterprise plan',
  },
  {
    id: '2',
    name: 'Mike Rodriguez',
    email: 'mike@startup.io',
    company: 'StartupXYZ',
    role: 'CTO',
    dealStatus: 'Negotiation',
    lastContact: '2024-03-20',
    nextSteps: { action: 'Send Contract', date: '2024-03-23' },
    notes: 'Budget approved, ready to close',
  },
  {
    id: '3',
    name: 'Jessica Park',
    email: 'jessica@innovate.com',
    company: 'Innovate Labs',
    role: 'Product Manager',
    dealStatus: 'Closed Won',
    lastContact: '2024-03-22',
    nextSteps: { action: 'Onboarding', date: '2024-03-30' },
    notes: 'Annual contract signed',
  },
  {
    id: '4',
    name: 'David Kim',
    email: 'david@globaltech.com',
    company: 'Global Tech',
    role: 'Director of Sales',
    dealStatus: 'Qualified',
    lastContact: '2024-03-19',
    nextSteps: { action: 'Meeting', date: '2024-03-22' },
    notes: 'Good fit, moving forward',
  },
];

export function CRMTablePreview() {
  return (
    <div className="bg-card rounded-lg border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium">Name</TableHead>
            <TableHead className="font-medium">Company</TableHead>
            <TableHead className="font-medium">Role</TableHead>
            <TableHead className="font-medium">Deal Status</TableHead>
            <TableHead className="font-medium">Last Contact</TableHead>
            <TableHead className="font-medium">Next Steps</TableHead>
            <TableHead className="font-medium">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sampleContacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-muted-foreground text-xs">{contact.email}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-sm">{contact.company}</div>
              </TableCell>
              <TableCell>
                <div className="text-sm">{contact.role}</div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={cn(getDealStatusColor(contact.dealStatus))}>
                  {contact.dealStatus}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  {new Date(contact.lastContact).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(getNextStepColor(contact.nextSteps.action))}
                >
                  {contact.nextSteps.action}
                  {contact.nextSteps.date && (
                    <span className="ml-1 opacity-70">
                      @{' '}
                      {new Date(contact.nextSteps.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="text-muted-foreground max-w-[200px] truncate text-xs">
                  {contact.notes}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
