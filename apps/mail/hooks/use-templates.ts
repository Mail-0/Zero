import { useState, useEffect } from 'react';
import { templatesApi, type Template, type CreateTemplateRequest } from '@/lib/templates';
import { toast } from 'sonner';

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await templatesApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      console.error('Error fetching templates:', err);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (template: CreateTemplateRequest) => {
    try {
      const newTemplate = await templatesApi.createTemplate(template);
      setTemplates(prev => [newTemplate, ...prev]);
      
      // Show success message
      console.log('Template saved successfully!');
      toast.success('Template saved successfully!');
      
      return newTemplate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      console.error('Error saving template:', errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const updateTemplate = async (id: string, template: Partial<CreateTemplateRequest>) => {
    try {
      const updatedTemplate = await templatesApi.updateTemplate(id, template);
      setTemplates(prev => prev.map(t => t.id === id ? updatedTemplate : t));
      
      console.log('Template updated successfully!');
      toast.success('Template updated successfully!');
      
      return updatedTemplate;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update template';
      console.error('Error updating template:', errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      await templatesApi.deleteTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      
      console.log('Template deleted successfully!');
      toast.success('Template deleted successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete template';
      console.error('Error deleting template:', errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}