import { useEffect, useState } from 'react';

export default function LoggingDemoPage() {
    const [sessionStats, setSessionStats] = useState<any>(null);
    const [callHistory, setCallHistory] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch session stats
                const statsResponse = await fetch('http://localhost:8787/api/trpc/logging.getSessionStats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                });
                const statsData = await statsResponse.json();
                setSessionStats(statsData);

                // Fetch call history
                const historyResponse = await fetch('http://localhost:8787/api/trpc/logging.getCallHistory', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        json: { limit: 100 }
                    }),
                });
                const historyData = await historyResponse.json();
                setCallHistory(historyData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    const jsonData = {
        sessionStats,
        callHistory,
        timestamp: new Date().toISOString(),
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <h1 className="text-2xl font-bold mb-4">Session Logging JSON Output</h1>
            <div className="h-[calc(100vh-200px)] overflow-auto">
                <pre className="bg-gray-900 text-green-400 p-4 rounded text-sm whitespace-pre-wrap">
                    {JSON.stringify(jsonData, null, 2)}
                </pre>
            </div>
        </div>
    );
} 