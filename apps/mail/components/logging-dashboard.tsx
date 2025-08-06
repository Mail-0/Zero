'use client';

import { api } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { RefreshCw, Trash2, Activity } from 'lucide-react';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function LoggingDashboard() {
    const [limit, setLimit] = useState(50);

    const { data: stats, refetch: refetchStats } = api.logging.getSessionStats.useQuery();
    const { data: history, refetch: refetchHistory } = api.logging.getCallHistory.useQuery({ limit });
    const clearSessionMutation = api.logging.clearSession.useMutation({
        onSuccess: () => {
            refetchStats();
            refetchHistory();
        },
    });

    const handleClearSession = () => {
        clearSessionMutation.mutate();
    };

    if (!stats || !history) {
        return <div>Loading...</div>;
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Session Logging Dashboard</h1>
                <div className="flex gap-2">
                    <Button onClick={() => { refetchStats(); refetchHistory(); }} variant="outline" size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Session
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Clear Session Logs</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to clear all session logs? This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearSession}>
                                    Clear Logs
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalCalls}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Errors</CardTitle>
                        <Badge variant={stats.errorRate > 5 ? 'destructive' : 'secondary'}>
                            {stats.totalErrors}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.errorRate.toFixed(1)}%</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.averageDuration.toFixed(0)}ms</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Session Duration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatDistanceToNow(Date.now() - stats.sessionDuration, { addSuffix: true })}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Call History */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Calls</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mb-4">
                        <Button
                            onClick={() => setLimit(50)}
                            variant={limit === 50 ? 'default' : 'outline'}
                            size="sm"
                        >
                            50
                        </Button>
                        <Button
                            onClick={() => setLimit(100)}
                            variant={limit === 100 ? 'default' : 'outline'}
                            size="sm"
                        >
                            100
                        </Button>
                        <Button
                            onClick={() => setLimit(500)}
                            variant={limit === 500 ? 'default' : 'outline'}
                            size="sm"
                        >
                            500
                        </Button>
                    </div>

                    <ScrollArea className="h-96">
                        <div className="space-y-2">
                            {history.map((call) => (
                                <div
                                    key={call.id}
                                    className={`p-3 rounded-lg border ${call.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={call.metadata.method === 'query' ? 'default' : 'secondary'}>
                                                {call.metadata.method}
                                            </Badge>
                                            <span className="font-mono text-sm">{call.procedure}</span>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {call.duration}ms
                                        </div>
                                    </div>

                                    <div className="mt-2 text-xs text-muted-foreground">
                                        {new Date(call.timestamp).toLocaleString()}
                                    </div>

                                    {call.error && (
                                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                                            Error: {call.error}
                                        </div>
                                    )}

                                    {call.input && Object.keys(call.input).length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-sm cursor-pointer">Input</summary>
                                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto">
                                                {JSON.stringify(call.input, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
} 