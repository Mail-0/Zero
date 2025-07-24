import { Button } from '@/components/ui/button';
import { useConnections } from '@/hooks/use-connections';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function IntegrationsPage() {
  const { data, isLoading, refetch } = useConnections();
  const trpc = useTRPC();
  const { mutateAsync: deleteConnection } = useMutation(trpc.connections.delete.mutationOptions());
  const { mutateAsync: toggleCalendar } = useMutation(trpc.connections.toggleCalendar.mutationOptions());

  const { data: defaultConnection } = useQuery(trpc.connections.getDefault.queryOptions());

  const googleConnections = data?.connections?.filter((c: { providerId: string }) => c.providerId === 'google') || [];
  const googleConn = googleConnections[0]; 

  const isConnected = !!googleConn;
  const scope = googleConn?.scope || '';
  const hasCalendarScope = scope.includes('https://www.googleapis.com/auth/calendar') || scope.includes('https://www.googleapis.com/auth/calendar.events');

  const calendarEnabled = googleConn?.calendarEnabled;

  const upcomingQuery = useQuery(
    trpc.calendar.upcoming.queryOptions(
      { max: 5 },
      {
        enabled: hasCalendarScope && calendarEnabled,
        staleTime: 1000 * 30,
      },
    ),
  );

  const {
    data: upcomingData,
    isLoading: loadingUpcoming,
    error: upcomingError,
  } = upcomingQuery as any;
  const firstEvent = Array.isArray(upcomingData) && upcomingData.length ? upcomingData[0] : null;

  const connect = () => {
    authClient
      .linkSocial({
        provider: 'google',
        callbackURL: `${window.location.origin}/settings/integrations`,
        scopes: [
          'https://www.googleapis.com/auth/calendar',
        ],
      })
      .catch(console.error);
  };

  const disconnect = async () => {
    if (!googleConn) return;

    toast.promise(toggleCalendar({ connectionId: googleConn.id, enabled: false }), {
      loading: 'Disconnecting...',
      success: () => {
        refetch();
        return 'Disconnected successfully';
      },
      error: 'Failed to disconnect',
    });
  };

  const enable = async () => {
    if (!googleConn) return;

    toast.promise(toggleCalendar({ connectionId: googleConn.id, enabled: true }), {
      loading: 'Enabling...',
      success: () => {
        refetch();
        return 'Enabled successfully';
      },
      error: 'Failed to enable',
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Integrations</h1>

      {/* Debug Information */}
      {/* <div className="border border-yellow-500 rounded-lg p-4 bg-yellow-50 text-black dark:text-black">
        <h3 className="font-semibold text-yellow-800 mb-2">🐛 Debug Information</h3>
        <div className="text-sm space-y-1">
          <p><strong>Total Google connections:</strong> {googleConnections.length}</p>
          <p><strong>Active/Default connection ID:</strong> {defaultConnection?.id || 'None'}</p>
          <p><strong>Active connection email:</strong> {defaultConnection?.email || 'None'}</p>

          {googleConnections.length > 0 && (
            <div className="mt-2">
              <p><strong>All Google connections:</strong></p>
              {googleConnections.map((conn: any, index: number) => (
                <div key={conn.id} className="ml-4 p-2 border rounded mt-1 bg-white">
                  <p>#{index + 1}: {conn.email} (ID: {conn.id})</p>
                  <p>Has calendar: {conn.hasCalendar ? '✅' : '❌'}</p>
                  <p>Scope: {conn.scope}</p>
                  <p>Is active: {conn.id === defaultConnection?.id ? '✅ ACTIVE' : '❌'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div> */}

      <div className="border rounded-lg p-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Google Calendar</h2>

          {!isConnected && <p className="text-sm text-gray-600">Connect your Google account.</p>}
          {isConnected && !hasCalendarScope && (
            <p className="text-sm text-yellow-600">
              Calendar access not granted. Please grant access.
            </p>
          )}
          {isConnected && hasCalendarScope && calendarEnabled && !loadingUpcoming && (
            <p className="text-sm text-gray-600">Your Google Calendar is connected.</p>
          )}
          {isConnected && hasCalendarScope && !calendarEnabled && (
            <p className="text-sm text-gray-600">Calendar integration is disabled.</p>
          )}

          {hasCalendarScope && calendarEnabled && !loadingUpcoming && firstEvent && (
            <p className="text-sm mt-2">
              Next event: <strong>{firstEvent.summary ?? 'No title'}</strong>{' '}
              {firstEvent.start ? `at ${new Date(firstEvent.start).toLocaleString()}` : ''}
            </p>
          )}

          {hasCalendarScope && calendarEnabled && !loadingUpcoming && !firstEvent && (
            <p className="text-sm mt-2">No upcoming events found.</p>
          )}

          {upcomingError && (
            <p className="text-sm text-red-500 mt-2">
              Could not load events. Please try reconnecting.
              <br />
              <strong>Error:</strong> {String(upcomingError)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && <Button onClick={connect}>Connect</Button>}
          {isConnected && !hasCalendarScope && <Button onClick={connect}>Grant Access</Button>}
          {isConnected && hasCalendarScope && calendarEnabled && (
            <Button variant="destructive" onClick={disconnect}>
              Disconnect
            </Button>
          )}
          {isConnected && hasCalendarScope && !calendarEnabled && (
            <Button onClick={enable}>
              Enable
            </Button>
          )}
        </div>
      </div>
      {/* <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto text-xs">
        {JSON.stringify({
          connections: data?.connections,
          googleConn,
          hasCalendar: googleConn?.hasCalendar,
          connected: isConnected,
          upcomingData: upcomingData ?? null,
          loadingUpcoming,
          upcomingError: upcomingError ?? null,
          defaultConnection,
          googleConnections,
        }, null, 2)}
      </pre> */}
    </div>
  );
} 