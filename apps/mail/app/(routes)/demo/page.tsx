import { Link } from 'react-router';

export default function DemoPage() {
    return (
        <div className="min-h-screen bg-background p-8">
            <h1 className="text-3xl font-bold mb-4">TRPC Call Logging</h1>
            <p className="text-muted-foreground mb-8">
                Simple JSON output of all TRPC calls with routes, inputs, and outputs.
            </p>

            <div>
                <h2 className="text-xl font-semibold mb-2">Session Logging</h2>
                <Link to="/demo/logging" className="text-blue-500 hover:underline">
                    /demo/logging - View all TRPC calls JSON
                </Link>
            </div>
        </div>
    );
} 