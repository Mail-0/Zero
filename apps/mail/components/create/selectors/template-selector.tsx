"use client";

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';


import { useTemplates } from '../../../hooks/use-templates';
import type { Template } from '../../../lib/templates';




interface TemplateSelectorProps {
  onSelectTemplate: (template: Template) => void;
  className?: string;
}

export function TemplateSelector({ onSelectTemplate, className }: TemplateSelectorProps) {
  const { templates, loading, error } = useTemplates();
  const [selectedValue, setSelectedValue] = useState<string>('');

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((t: Template) => t.id === templateId);
    if (template) {
      onSelectTemplate(template);
      setSelectedValue(''); 
    }
  };

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className={className}>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading templates...
      </Button>
    );
  }

  if (error || templates.length === 0) {
    return null; 
  }

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <FileText className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedValue} onValueChange={handleSelectTemplate}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Use template..." />
        </SelectTrigger>
        <SelectContent>
          {templates.map((template: Template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}