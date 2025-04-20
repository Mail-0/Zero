import { CreateEmail } from '@/components/create/create-email';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

// Define the type for search params
interface CreatePageProps {
  searchParams: Promise<{
    to?: string;
    subject?: string;
    body?: string;
  }>;
}

export default async function CreatePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="h-full flex-1">
        <CreateEmail />
      </div>
    </div>
  );
}

export async function generateMetadata({ searchParams }: CreatePageProps) {
  // Need to await searchParams in Next.js 15+
  const params = await searchParams;
  
  const toParam = params.to || 'someone';
  
  // Create metadata object
  return {
    title: `Email ${toParam} on Zero`,
    description: 'Zero - The future of email is here',
    openGraph: {
      title: `Email ${toParam} on Zero`,
      description: 'Zero - The future of email is here',
      images: [`/api/og/create?to=${encodeURIComponent(toParam)}${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ''}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Email ${toParam} on Zero`,
      description: 'Zero - The future of email is here',
      images: [`/api/og/create?to=${encodeURIComponent(toParam)}${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ''}`],
    }
  };
}
