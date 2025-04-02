import { CreateEmail } from '@/components/create/create-email';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function CreatePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session) {
    redirect('/');
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="h-full flex-1">
        <CreateEmail />
      </div>
    </div>
  );
}
