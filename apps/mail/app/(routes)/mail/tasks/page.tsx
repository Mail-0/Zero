import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Background Tasks - Zero',
  description: 'Monitor background tasks and processes',
};

export default function TasksPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold">Background Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Monitor and manage background processes and tasks
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
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Background Tasks Coming Soon</h3>
            <p className="text-muted-foreground mt-2 max-w-sm">
              Background task monitoring is being developed. You'll be able to track running processes here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
