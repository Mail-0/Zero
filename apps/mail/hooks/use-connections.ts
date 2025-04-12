import { deleteConnection, putConnection } from "@/actions/connections";
import { type IConnection } from "@/types";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useConnections = () => {
  const { data, error, isLoading, mutate } = useSWR<IConnection[]>(
    "/api/driver/connections",
    fetcher
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};
