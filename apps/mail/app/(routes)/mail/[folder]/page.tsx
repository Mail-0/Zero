import { Navigate, useLoaderData, useNavigate } from 'react-router';
import { useTRPC } from '@/providers/query-provider';
import { MailLayout } from '@/components/mail/mail';
import { useQuery } from '@tanstack/react-query';
import { authProxy } from '@/lib/auth-proxy';
import { useEffect, useState } from 'react';
import type { Route } from './+types/page';
import { Loader2 } from 'lucide-react';

const ALLOWED_FOLDERS = ['inbox', 'draft', 'sent', 'spam', 'bin', 'archive'];

export async function loader({ params, request }: Route.LoaderArgs) {
  if (!params.folder) return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/mail/inbox`);

  const session = await authProxy.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);

  return {
    folder: params.folder,
  };
}

export default function MailPage() {
  const { folder } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const [isLabelValid, setIsLabelValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isStandardFolder = ALLOWED_FOLDERS.includes(folder);

  const { data: userLabels, isLoading: isLoadingLabels } = useQuery(
    trpc.labels.list.queryOptions(void 0),
  );

  useEffect(() => {
    if (isStandardFolder) {
      setIsLabelValid(true);
      setIsLoading(false);
      return;
    }

    if (isLoadingLabels) return;

    if (userLabels) {
      const checkLabelExists = (labels: any[]): boolean => {
        for (const label of labels) {
          if (label.id === folder) return true;
          if (label.labels && label.labels.length > 0) {
            if (checkLabelExists(label.labels)) return true;
          }
        }
        return false;
      };

      const labelExists = checkLabelExists(userLabels);
      setIsLabelValid(labelExists);
      setIsLoading(false);

      if (!labelExists) {
        const timer = setTimeout(() => {
          navigate('/mail/inbox');
        }, 2000);
        return () => clearTimeout(timer);
      }
    } else {
      setIsLabelValid(false);
      setIsLoading(false);
    }
  }, [folder, userLabels, isLoadingLabels, isStandardFolder, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <span className="ml-2">Loading folder...</span>
      </div>
    );
  }

  if (!isLabelValid) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center">
        <h2 className="text-xl font-semibold">Folder not found</h2>
        <p className="text-muted-foreground mt-2">
          The folder you're looking for doesn't exist. Redirecting to inbox...
        </p>
      </div>
    );
  }

  return <MailLayout />;
}
