import { CreateEmail } from '@/components/create/create-email';
import { authProxy } from '@/lib/auth-proxy';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Define the type for search params
interface CreatePageProps {
  searchParams: Promise<{
    to?: string;
    subject?: string;
    body?: string;
  }>;
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const headersList = await headers();
  const session = await authProxy.api.getSession({ headers: headersList });
  if (!session) {
    redirect('/login');
  }
  const params = await searchParams;
  const toParam = params.to || 'someone@someone.com';
  redirect(
    `/mail/inbox?isComposeOpen=true&to=${encodeURIComponent(toParam)}${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ''}`,
  );
}

export async function generateMetadata({ searchParams }: CreatePageProps) {
  // Need to await searchParams in Next.js 15+
  const params = await searchParams;

  const toParam = params.to || 'someone';

  // Create common metadata properties
  const title = `Email ${toParam} on Zero`;
  const description = 'Zero - The future of email is here';
  const imageUrl = `/og-api/create?to=${encodeURIComponent(toParam)}${params.subject ? `&subject=${encodeURIComponent(params.subject)}` : ''}`;

  // Create metadata object
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}
