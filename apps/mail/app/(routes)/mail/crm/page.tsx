import {
  Type,
  Hash,
  Calendar,
  CheckSquare,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Trash2,
  Mail,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Timeline, type HistoryEvent } from '@/components/crm/timeline';
import { DatePicker } from '@/components/ui/date-picker';
import { useState, useMemo, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import React from 'react';

// Data type definitions
type ColumnType =
  | 'text'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'select'
  | 'email'
  | 'timeline'
  | 'next-step';

interface CRMColumn {
  id: string;
  name: string;
  type: ColumnType;
  description: string;
  options?: string[];
  isFixed?: boolean;
}

interface NextStep {
  action: string;
  date?: string;
}

interface CRMRow {
  id: string;
  [key: string]: string | boolean | number | HistoryEvent[] | NextStep | undefined;
}

// Icon mapping for column types
const getColumnIcon = (type: ColumnType) => {
  switch (type) {
    case 'text':
      return <Type className="h-4 w-4" />;
    case 'number':
      return <Hash className="h-4 w-4" />;
    case 'date':
      return <Calendar className="h-4 w-4" />;
    case 'checkbox':
      return <CheckSquare className="h-4 w-4" />;
    case 'select':
      return <ChevronDown className="h-4 w-4" />;
    case 'email':
      return <Mail className="h-4 w-4" />;
    case 'timeline':
      return <Clock className="h-4 w-4" />;
    default:
      return <Type className="h-4 w-4" />;
  }
};

// Separate component for editable column header to prevent unnecessary re-renders
interface EditableColumnHeaderProps {
  colConfig: CRMColumn;
  onUpdate: (updatedColumn: CRMColumn) => void;
  onDelete: (columnId: string) => void;
}

const EditableColumnHeader = React.memo(
  ({ colConfig, onUpdate, onDelete }: EditableColumnHeaderProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingColumn, setEditingColumn] = useState<CRMColumn | null>(null);

    const handleOpenChange = useCallback(
      (open: boolean) => {
        if (open) {
          setEditingColumn({ ...colConfig });
          setIsOpen(true);
        } else {
          setIsOpen(false);
          setEditingColumn(null);
        }
      },
      [colConfig],
    );

    const handleSave = useCallback(() => {
      if (editingColumn) {
        onUpdate(editingColumn);
        setIsOpen(false);
        setEditingColumn(null);
      }
    }, [editingColumn, onUpdate]);

    const handleDelete = useCallback(() => {
      onDelete(colConfig.id);
      setIsOpen(false);
      setEditingColumn(null);
    }, [colConfig.id, onDelete]);

    return (
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-2 text-left hover:opacity-70">
              <div className="text-muted-foreground">{getColumnIcon(colConfig.type)}</div>
              <span className="font-medium">{colConfig.name}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            {editingColumn && (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-3 font-medium leading-none">Edit Column</h4>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit-name-${colConfig.id}`}>Column Name</Label>
                  <Input
                    id={`edit-name-${colConfig.id}`}
                    value={editingColumn.name}
                    onChange={(e) => setEditingColumn({ ...editingColumn, name: e.target.value })}
                    placeholder="Column name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Column Type</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          {getColumnIcon(editingColumn.type)}
                          <span className="capitalize">{editingColumn.type}</span>
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'text' })}
                      >
                        <Type className="mr-2 h-4 w-4" />
                        Text
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'email' })}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Email
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'number' })}
                      >
                        <Hash className="mr-2 h-4 w-4" />
                        Number
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'date' })}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        Date
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'checkbox' })}
                      >
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Checkbox
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'select' })}
                      >
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Select
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setEditingColumn({ ...editingColumn, type: 'timeline' })}
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Timeline
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit-description-${colConfig.id}`}>Description</Label>
                  <Textarea
                    id={`edit-description-${colConfig.id}`}
                    value={editingColumn.description}
                    onChange={(e) =>
                      setEditingColumn({ ...editingColumn, description: e.target.value })
                    }
                    placeholder="Add a description for this column..."
                    rows={3}
                  />
                </div>
                {colConfig.isFixed && (
                  <div className="bg-muted rounded-md p-3">
                    <p className="text-muted-foreground text-sm">
                      This is a fixed column and cannot be deleted.
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  {!colConfig.isFixed && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={handleDelete}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsOpen(false);
                      setEditingColumn(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" className="flex-1" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
        {!colConfig.isFixed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  },
);
EditableColumnHeader.displayName = 'EditableColumnHeader';

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
    case 'done':
    case 'completed':
      return 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200';
    case 'waiting':
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200';
    case 'onboarding':
      return 'bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-900 dark:text-teal-200';
    default:
      return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200';
  }
};

// Default columns configuration
const defaultColumnsConfig: CRMColumn[] = [
  {
    id: 'name',
    name: 'Name',
    type: 'text',
    description: 'Contact name',
    isFixed: true,
  },
  {
    id: 'email',
    name: 'Email',
    type: 'email',
    description: 'Email address',
    isFixed: true,
  },
  {
    id: 'company',
    name: 'Company',
    type: 'text',
    description: 'Company name',
  },
  {
    id: 'role',
    name: 'Role',
    type: 'text',
    description: 'Job title or role',
  },
  {
    id: 'dealStatus',
    name: 'Deal Status',
    type: 'select',
    description: 'Current status of the deal',
    options: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
  },
  {
    id: 'lastContact',
    name: 'Last Contact',
    type: 'date',
    description: 'Date of last contact',
  },
  {
    id: 'nextSteps',
    name: 'Next Steps',
    type: 'next-step',
    description: 'Planned next steps or actions',
  },
  {
    id: 'history',
    name: 'History',
    type: 'timeline',
    description: 'Interaction history and past communications',
  },
  {
    id: 'notes',
    name: 'Notes',
    type: 'text',
    description: 'Additional notes',
  },
];

export default function CRMPage() {
  const [columnsConfig, setColumnsConfig] = useState<CRMColumn[]>(defaultColumnsConfig);
  const [data, setData] = useState<CRMRow[]>([
    {
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      company: 'Acme Corp',
      role: 'CEO',
      dealStatus: 'Proposal',
      lastContact: '2024-01-15',
      nextSteps: { action: 'Schedule Call', date: '2024-01-25' } as NextStep,
      history: [
        {
          id: 'h1',
          type: 'inbound_email',
          title: 'Initial inquiry',
          date: '2024-01-10',
          description: 'Asked about enterprise features',
        },
        {
          id: 'h2',
          type: 'meeting',
          title: 'Discovery call',
          date: '2024-01-12',
          description: 'Discussed requirements and pricing',
        },
        {
          id: 'h3',
          type: 'outbound_email',
          title: 'Sent proposal',
          date: '2024-01-15',
          description: 'Proposal for enterprise plan',
        },
      ] as HistoryEvent[],
      notes: 'Interested in enterprise plan',
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@techstart.io',
      company: 'TechStart',
      role: 'CTO',
      dealStatus: 'Negotiation',
      lastContact: '2024-01-20',
      nextSteps: { action: 'Send Contract', date: '2024-01-23' } as NextStep,
      history: [
        {
          id: 'h4',
          type: 'meeting',
          title: 'Technical demo',
          date: '2024-01-18',
          description: 'Showed API integration',
        },
        {
          id: 'h5',
          type: 'call',
          title: 'Pricing discussion',
          date: '2024-01-20',
          description: 'Negotiated volume discount',
        },
      ] as HistoryEvent[],
      notes: 'Very interested, budget approved',
    },
    {
      id: '3',
      name: 'Michael Chen',
      email: 'mchen@innovate.com',
      company: 'Innovate Labs',
      role: 'Product Manager',
      dealStatus: 'Closed Won',
      lastContact: '2024-01-22',
      nextSteps: { action: 'Onboarding', date: '2024-01-30' } as NextStep,
      history: [
        {
          id: 'h6',
          type: 'meeting',
          title: 'Initial meeting',
          date: '2024-01-05',
        },
        {
          id: 'h7',
          type: 'outbound_email',
          title: 'Sent proposal',
          date: '2024-01-10',
        },
        {
          id: 'h8',
          type: 'document',
          title: 'Contract signed',
          date: '2024-01-22',
          description: 'Signed annual contract',
        },
      ] as HistoryEvent[],
      notes: 'Deal closed! Annual contract',
    },
    {
      id: '4',
      name: 'Emily Rodriguez',
      email: 'emily@designco.com',
      company: 'Design Co',
      role: 'VP Marketing',
      dealStatus: 'Lead',
      lastContact: '2024-01-08',
      nextSteps: { action: 'Follow Up', date: '2024-01-15' } as NextStep,
      history: [
        {
          id: 'h9',
          type: 'inbound_email',
          title: 'Downloaded whitepaper',
          date: '2024-01-08',
          description: 'Interested in marketing automation',
        },
      ] as HistoryEvent[],
      notes: 'Early stage, needs nurturing',
    },
    {
      id: '5',
      name: 'David Park',
      email: 'david@globaltech.com',
      company: 'Global Tech',
      role: 'Director of Sales',
      dealStatus: 'Qualified',
      lastContact: '2024-01-19',
      nextSteps: { action: 'Meeting', date: '2024-01-22' } as NextStep,
      history: [
        {
          id: 'h10',
          type: 'call',
          title: 'Qualification call',
          date: '2024-01-19',
          description: 'Confirmed budget and timeline',
        },
      ] as HistoryEvent[],
      notes: 'Good fit, moving to next stage',
    },
    {
      id: '6',
      name: 'Lisa Anderson',
      email: 'lisa@oldcorp.com',
      company: 'Old Corp',
      role: 'CEO',
      dealStatus: 'Closed Lost',
      lastContact: '2024-01-12',
      nextSteps: { action: 'Done' } as NextStep,
      history: [
        {
          id: 'h11',
          type: 'meeting',
          title: 'Final presentation',
          date: '2024-01-12',
          description: 'Chose competitor',
        },
      ] as HistoryEvent[],
      notes: 'Budget constraints, went with cheaper option',
    },
  ]);

  const [newColumn, setNewColumn] = useState<Partial<CRMColumn>>({
    name: '',
    type: 'text',
    description: '',
  });
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);

  // Update cell value
  const updateCell = useCallback(
    (
      rowId: string,
      columnId: string,
      value: string | boolean | number | HistoryEvent[] | NextStep,
    ) => {
      setData((old) =>
        old.map((row) => {
          if (row.id === rowId) {
            return { ...row, [columnId]: value };
          }
          return row;
        }),
      );
    },
    [],
  );

  // Add new row
  const addRow = () => {
    const newRow: CRMRow = {
      id: `${Date.now()}`,
    };
    setData([...data, newRow]);
  };

  // Delete row
  const deleteRow = useCallback((rowId: string) => {
    setData((prev) => prev.filter((row) => row.id !== rowId));
  }, []);

  // Add new column
  const addColumn = () => {
    if (!newColumn.name) return;
    const column: CRMColumn = {
      id: `col_${Date.now()}`,
      name: newColumn.name,
      type: newColumn.type || 'text',
      description: newColumn.description || '',
      options: newColumn.type === 'select' ? [] : undefined,
    };
    setColumnsConfig([...columnsConfig, column]);
    setNewColumn({ name: '', type: 'text', description: '' });
    setIsAddColumnOpen(false);
  };

  // Update column
  const updateColumn = useCallback((updatedColumn: CRMColumn) => {
    setColumnsConfig((prev) =>
      prev.map((col) => (col.id === updatedColumn.id ? updatedColumn : col)),
    );
  }, []);

  // Delete column
  const deleteColumn = useCallback((columnId: string) => {
    setColumnsConfig((prev) => {
      const column = prev.find((col) => col.id === columnId);
      if (column?.isFixed) return prev;
      return prev.filter((col) => col.id !== columnId);
    });
    // Remove data from rows
    setData((prev) =>
      prev.map((row) => {
        const newRow = { ...row };
        delete newRow[columnId];
        return newRow;
      }),
    );
  }, []);

  // Render cell based on column type
  const renderEditableCell = useCallback(
    (
      rowId: string,
      column: CRMColumn,
      value: string | boolean | number | HistoryEvent[] | NextStep | undefined,
    ) => {
      switch (column.type) {
        case 'next-step':
          const nextStep = value as NextStep | undefined;
          if (nextStep && nextStep.action) {
            return (
              <Badge variant="secondary" className={cn(getNextStepColor(nextStep.action))}>
                {nextStep.action}
                {nextStep.date && (
                  <span className="ml-1 opacity-70">
                    @{' '}
                    {new Date(nextStep.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </Badge>
            );
          }
          return <span className="text-muted-foreground text-sm">No next step</span>;
        case 'timeline':
          return (
            <div className="min-w-[300px]">
              <Timeline
                events={(value as HistoryEvent[]) || []}
                onChange={(events) => updateCell(rowId, column.id, events)}
              />
            </div>
          );
        case 'checkbox':
          return (
            <Checkbox
              checked={typeof value === 'boolean' ? value : false}
              onCheckedChange={(checked) => updateCell(rowId, column.id, checked === true)}
            />
          );
        case 'select':
          // Special rendering for Deal Status column with colored badges
          if (column.id === 'dealStatus' && typeof value === 'string' && value) {
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={cn('cursor-pointer', getDealStatusColor(value))}
                  >
                    {value}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {column.options?.map((option) => (
                    <DropdownMenuItem
                      key={option}
                      onClick={() => updateCell(rowId, column.id, option)}
                    >
                      <Badge variant="secondary" className={cn('mr-2', getDealStatusColor(option))}>
                        {option}
                      </Badge>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          // Default select rendering for other columns
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-full justify-start">
                  {(typeof value === 'string' || typeof value === 'number' ? value : undefined) ||
                    'Select...'}
                  <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {column.options?.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => updateCell(rowId, column.id, option)}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        case 'date':
          return (
            <DatePicker
              value={typeof value === 'string' ? value : undefined}
              onChange={(date) => updateCell(rowId, column.id, date)}
              placeholder="Select date"
            />
          );
        case 'number':
          return (
            <Input
              type="number"
              value={typeof value === 'number' || typeof value === 'string' ? value : ''}
              onChange={(e) => updateCell(rowId, column.id, e.target.value)}
              className="h-8 border-0 bg-transparent focus-visible:ring-0"
            />
          );
        default:
          return (
            <Input
              type={column.type === 'email' ? 'email' : 'text'}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => updateCell(rowId, column.id, e.target.value)}
              className="h-8 border-0 bg-transparent focus-visible:ring-0"
              placeholder={`Enter ${column.name.toLowerCase()}...`}
            />
          );
      }
    },
    [updateCell],
  );

  // Create TanStack Table columns from our column config
  const columns = useMemo<ColumnDef<CRMRow>[]>(() => {
    const cols: ColumnDef<CRMRow>[] = columnsConfig.map((colConfig) => ({
      id: colConfig.id,
      accessorKey: colConfig.id,
      header: () => (
        <EditableColumnHeader
          colConfig={colConfig}
          onUpdate={updateColumn}
          onDelete={deleteColumn}
        />
      ),
      cell: ({ row }) =>
        renderEditableCell(
          row.original.id,
          colConfig,
          row.getValue(colConfig.id) as
            | string
            | boolean
            | number
            | HistoryEvent[]
            | NextStep
            | undefined,
        ),
    }));

    // Add actions column
    cols.push({
      id: 'actions',
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => deleteRow(row.original.id)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Row
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });

    return cols;
  }, [columnsConfig, deleteColumn, deleteRow, renderEditableCell, updateColumn]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="bg-background border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">CRM</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Manage your contacts and relationships
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={addRow} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
            <Popover open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Column
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="mb-3 font-medium leading-none">Add New Column</h4>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="column-name">Column Name</Label>
                    <Input
                      id="column-name"
                      value={newColumn.name}
                      onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                      placeholder="e.g., Phone Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="column-type">Column Type</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="flex items-center gap-2">
                            {getColumnIcon(newColumn.type || 'text')}
                            <span className="capitalize">{newColumn.type || 'text'}</span>
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full">
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'text' })}
                        >
                          <Type className="mr-2 h-4 w-4" />
                          Text
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'email' })}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Email
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'number' })}
                        >
                          <Hash className="mr-2 h-4 w-4" />
                          Number
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'date' })}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Date
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'checkbox' })}
                        >
                          <CheckSquare className="mr-2 h-4 w-4" />
                          Checkbox
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'select' })}
                        >
                          <ChevronDown className="mr-2 h-4 w-4" />
                          Select
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setNewColumn({ ...newColumn, type: 'timeline' })}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          Timeline
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="column-description">Description (Optional)</Label>
                    <Textarea
                      id="column-description"
                      value={newColumn.description}
                      onChange={(e) => setNewColumn({ ...newColumn, description: e.target.value })}
                      placeholder="Add a description for this column..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsAddColumnOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button className="flex-1" onClick={addColumn}>
                      Add Column
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Table Container with Padding */}
      <div className="flex-1 overflow-auto p-8">
        <div className="bg-card rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="group hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="group">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-muted-foreground mb-4">No contacts yet</p>
                      <Button onClick={addRow} variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add your first contact
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
