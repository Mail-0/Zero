import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Collections - Zero',
  description: 'Organize your emails into collections',
};

export default function CollectionsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Collections</h1>
          <p className="text-muted-foreground text-sm">
            Organize and group your emails into custom collections
          </p>
        </div>
      </div>
      
      <div className="flex-1 p-6">
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Collections Coming Soon</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Email collections feature is being developed. You'll be able to organize your emails into custom groups here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
