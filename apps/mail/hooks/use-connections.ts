import { getConnections, deleteConnection, putConnection } from "@/actions/connections";
import { IConnection } from "@/types";
import useSWR from "swr";

export const useConnections = () => {
  const { data, error, isLoading, mutate } = useSWR<IConnection[]>(
    "/api/v1/mail/connections",
    getConnections,
  );

  const handleDeleteConnection = async (connectionId: string) => {
    try {
      await deleteConnection(connectionId);
      mutate();
    } catch (error) {
      console.error("Failed to delete connection:", error);
      throw error;
    }
  };

  const handleSetDefaultConnection = async (connectionId: string) => {
    try {
      await putConnection(connectionId);
      mutate();
    } catch (error) {
      console.error("Failed to set default connection:", error);
      throw error;
    }
  };

  return {
    data,
    error,
    isLoading,
    mutate,
    deleteConnection: handleDeleteConnection,
    setDefaultConnection: handleSetDefaultConnection,
  };
};
