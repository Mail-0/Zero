'use client'
import { mailCount } from "@/actions/mail";
import { useSession } from "@/lib/auth-client";
import useSWR from "swr";

export const useStats = () => {
    const { data: session } = useSession();
    const { data = [], isValidating, isLoading, mutate, error } = useSWR<{ label: string, count: number }[]>(
        session?.connectionId ? `/mail-count/${session?.connectionId}` : null,
        mailCount,
        {
            revalidateOnMount: true
        }
    );

    return {
        data, isValidating, isLoading, mutate, error
    }
}
