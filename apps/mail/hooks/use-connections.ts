import { useTRPC } from "@/providers/query-provider";
import { useQuery } from "@tanstack/react-query";
import { CONNECTION_KEY } from "@/providers/connection-provider";

export const useConnections = () => {
  const trpc = useTRPC();
  const connectionsQuery = useQuery(trpc.connections.list.queryOptions());
  return connectionsQuery;
};

export const useActiveConnection = () => {
  // Get the connection directly from the getDefault query
  const connectionQuery = useQuery({
    queryKey: CONNECTION_KEY,
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  return {
    data: connectionQuery.data || null,
    isLoading: connectionQuery.isLoading,
    error: connectionQuery.error,
    refetch: connectionQuery.refetch,
  };
};
