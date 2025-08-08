import { useEffect, useState } from 'react';

export default function LoggingDemo() {
    const [sessionStats, setSessionStats] = useState<any>(null);
    const [callHistory, setCallHistory] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch session stats
            const statsResponse = await fetch('http://localhost:8787/api/trpc/logging.getSessionStats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': document.cookie // Include auth cookies
                },
                credentials: 'include',
                body: JSON.stringify({ json: {} }),
            });
            const statsData = await statsResponse.json();
            setSessionStats(statsData);

            // Fetch call history
            const historyResponse = await fetch('http://localhost:8787/api/trpc/logging.getCallHistory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': document.cookie // Include auth cookies
                },
                credentials: 'include',
                body: JSON.stringify({ json: { limit: 100 } }),
            });
            const historyData = await historyResponse.json();
            setCallHistory(historyData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const exportToDatadog = async () => {
        try {
            const response = await fetch('http://localhost:8787/api/trpc/logging.exportToDatadog', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': document.cookie
                },
                credentials: 'include',
                body: JSON.stringify({ json: {} }),
            });
            const result = await response.json();
            console.log('Datadog export result:', result);
            console.log('Session exported to Datadog!');
        } catch (error) {
            console.error('Error exporting to Datadog:', error);
            console.error('Failed to export to Datadog');
        }
    };

    const endSession = async () => {
        try {
            const response = await fetch('http://localhost:8787/api/trpc/logging.endSession', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': document.cookie
                },
                credentials: 'include',
                body: JSON.stringify({ json: {} }),
            });
            const result = await response.json();
            console.log('Session end result:', result);
            console.log('Session ended and exported to Datadog!');
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error ending session:', error);
            console.error('Failed to end session');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">TRPC Logging Demo</h1>

            <div className="mb-6 space-x-4">
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Refresh Data'}
                </button>
                <button
                    onClick={exportToDatadog}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    Export to Datadog
                </button>
                <button
                    onClick={endSession}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                    End Session
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-xl font-semibold mb-4">Session Stats</h2>
                    <div className="h-[calc(100vh-200px)] overflow-auto">
                        <pre className="whitespace-pre-wrap bg-gray-900 text-green-400 p-4 rounded text-sm">
                            {sessionStats ? JSON.stringify(sessionStats, null, 2) : 'Loading...'}
                        </pre>
                    </div>
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-4">Call History</h2>
                    <div className="h-[calc(100vh-200px)] overflow-auto">
                        <pre className="whitespace-pre-wrap bg-gray-900 text-green-400 p-4 rounded text-sm">
                            {callHistory ? JSON.stringify(callHistory, null, 2) : 'Loading...'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
} 