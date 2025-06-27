export interface Template {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTemplateRequest {
  name: string;
  subject?: string;
  content: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  subject?: string;
  content?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  count?: number;
}

class TemplatesApi {
  private baseUrl = '/api/templates';

  async getTemplates(): Promise<Template[]> {
    const response = await fetch(this.baseUrl, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch templates');
    }
    
    const result: ApiResponse<Template[]> = await response.json();
    return result.data || [];
  }

  async getTemplate(id: string): Promise<Template> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch template');
    }
    
    const result: ApiResponse<Template> = await response.json();
    if (!result.data) {
      throw new Error('Template not found');
    }
    
    return result.data;
  }

  async createTemplate(template: CreateTemplateRequest): Promise<Template> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(template),
    });
    
    if (!response.ok) {
      let errorMessage = 'Failed to create template';
      try {
        const errorData: any = await response.json();
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch (e) {
        // If response isn't JSON, use default message
      }
      throw new Error(errorMessage);
    }
    
    const result: ApiResponse<Template> = await response.json();
    if (!result.data) {
      throw new Error('Failed to create template');
    }
    
    return result.data;
  }

  async updateTemplate(id: string, template: UpdateTemplateRequest): Promise<Template> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(template),
    });
    
    if (!response.ok) {
      let errorMessage = 'Failed to update template';
      try {
        const errorData: any = await response.json();
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch (e) {
        // If response isn't JSON, use default message
      }
      throw new Error(errorMessage);
    }
    
    const result: ApiResponse<Template> = await response.json();
    if (!result.data) {
      throw new Error('Failed to update template');
    }
    
    return result.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    if (!response.ok) {
      let errorMessage = 'Failed to delete template';
      try {
        const errorData: any = await response.json();
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch (e) {
        // If response isn't JSON, use default message
      }
      throw new Error(errorMessage);
    }
  }
}

export const templatesApi = new TemplatesApi();