"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Trash2, 
  Edit, 
  Eye, 
  Search,
  FileText,
  Loader2 
} from 'lucide-react';
import { useTemplates } from '../../hooks/use-templates';
import type { Template } from '../../lib/templates';
import { toast } from 'sonner';

interface TemplateManagerProps {
  onSelectTemplate?: (template: Template) => void;
  trigger?: React.ReactNode;
}

export function TemplateManager({ onSelectTemplate, trigger }: TemplateManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { templates, loading, deleteTemplate } = useTemplates();

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.subject && template.subject.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(id);
        toast.success('Template deleted successfully!');
      } catch (error) {
        console.error('Failed to delete template:', error);
        toast.error('Failed to delete template');
      }
    }
  };

  const handleUseTemplate = (template: Template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
      toast.success(`Template "${template.name}" loaded successfully!`);
      setOpen(false);
    }
  };

  const handlePreviewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Settings className="h-4 w-4 mr-2" />
      Manage Templates
    </Button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Manager</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 flex-1 overflow-hidden">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Templates List */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Loading templates...
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  {searchQuery ? 'No templates found matching your search.' : 'No templates saved yet.'}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTemplates.map((template) => (
                    <div key={template.id} className="p-4 hover:bg-muted/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{template.name}</h3>
                          {template.subject && (
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              Subject: {template.subject}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Created: {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreviewTemplate(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {onSelectTemplate && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUseTemplate(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Preview: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4 flex-1 overflow-y-auto">
              {selectedTemplate.subject && (
                <div>
                  <Label className="text-sm font-medium">Subject</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    {selectedTemplate.subject}
                  </div>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">Content</Label>
                <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap">
                  {selectedTemplate.content}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Created: {new Date(selectedTemplate.createdAt).toLocaleString()}
                {selectedTemplate.updatedAt !== selectedTemplate.createdAt && (
                  <span className="ml-4">
                    Updated: {new Date(selectedTemplate.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4">
            {onSelectTemplate && selectedTemplate && (
              <Button
                onClick={() => handleUseTemplate(selectedTemplate)}
                className="mr-auto"
              >
                <Edit className="h-4 w-4 mr-2" />
                Use Template
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}