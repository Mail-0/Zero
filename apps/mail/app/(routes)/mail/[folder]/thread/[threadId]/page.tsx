import { ThreadDisplay } from '@/components/mail/thread-display';
import { authProxy } from '@/lib/auth-proxy';
import type { Route } from './+types/page';

export async function clientLoader({ params, request }: Route.ClientLoaderArgs) {
  const session = await authProxy.api.getSession({ headers: request.headers });
  if (!session) return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/login`);

  return {
    folder: params.folder,
    threadId: params.threadId,
  };
}

export default function ThreadPage() {
  return (
    <div className="h-screen w-full">
      <ThreadDisplay />
    </div>
  );
}
