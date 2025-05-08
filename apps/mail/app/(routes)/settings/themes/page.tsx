'use client';

import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { ThemeManagement } from './theme-management';
import { EmptyPlaceholder } from '@/components/empty-placeholder';
import { CustomThemeProvider } from '@/providers/custom-theme-provider';
import { useTRPCClient } from '@/providers/query-provider';
import { useSession } from '@/lib/auth-client';

// Define the Theme type
interface Theme {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  connectionId: string | null;
  settings: any; // Use the proper ThemeSettings type if available
  isPublic: boolean;
}

export default function ThemesPage() {
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState<Theme[]>([]); // Specify the type
  const [error, setError] = useState<Error | null>(null); // Specify the type
  const client = useTRPCClient();
  const { data: session } = useSession();

  useEffect(() => {
    async function loadThemes() {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      try {
        // First try to get user themes
        const result = await client.themes.getUserThemes.query();
        
        // If there are no themes, create default themes
        if (!result.success || result.themes.length === 0) {
          // Create default themes for the user
          const defaultResult = await client.themes.createDefaultThemes.mutate();
          
          if (defaultResult.success) {
            // Refresh themes after creating defaults
            const refreshResult = await client.themes.getUserThemes.query();
            if (refreshResult.success && refreshResult.themes && refreshResult.themes.length > 0) {
              setThemes(refreshResult.themes);
              setLoading(false);
              return;
            }
          }
          
          // Still no themes
          setThemes([]);
          setLoading(false);
          return;
        }
        
        setThemes(result.themes);
      } catch (err) {
        console.error('Error loading themes:', err);
        setError(err instanceof Error ? err : new Error('An unknown error occurred'));
      } finally {
        setLoading(false);
      }
    }

    loadThemes();
  }, [client, session?.user?.id]);

  // Content rendering
  const renderContent = () => {
    if (loading) {
      return <div>Loading themes...</div>;
    }

    if (!session?.user?.id) {
      return (
        <EmptyPlaceholder>
          <div className="text-center">
            <p>You need to be signed in to manage themes</p>
          </div>
        </EmptyPlaceholder>
      );
    }

    if (error) {
      return (
        <EmptyPlaceholder>
          <div className="text-center">
            <p>Error loading themes</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please try refreshing the page.
            </p>
          </div>
        </EmptyPlaceholder>
      );
    }

    if (themes.length === 0) {
      return (
        <EmptyPlaceholder>
          <div className="text-center">
            <p>No themes found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please refresh the page to see your themes.
            </p>
          </div>
        </EmptyPlaceholder>
      );
    }

    return (
      <CustomThemeProvider>
        <ThemeManagement initialThemes={themes} />
      </CustomThemeProvider>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Themes</h3>
        <p className="text-sm text-muted-foreground">
          Customize the appearance of your email client with personalized themes
        </p>
      </div>
      <Separator />
      {renderContent()}
    </div>
  );
} 