import { IConnection } from "@/types";
import axios from "axios";
import useSWR from "swr";

const fetchConnections = () => axios.get("/api/v1/mail/connections").then((r) => r.data);

export const useConnections = () => {
  // override the fetcher
  const { data, error, isLoading, mutate } = useSWR<{ connections: IConnection[] }>(
    "/api/v1/mail/connections",
    fetchConnections,
  );

  return {
    data: data?.connections,
    error,
    isLoading,
    mutate,
  };
};
