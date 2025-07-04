import React from 'react';
import { CircleCheck } from '../icons/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useTRPC } from '@/providers/query-provider';
import { useQuery } from '@tanstack/react-query';

interface EmailVerificationBadgeProps {
  messageId: string | undefined;
}

export const EmailVerificationBadge: React.FC<EmailVerificationBadgeProps> = ({ messageId }) => {
  const trpc = useTRPC();

  const { data: verificationResult, isLoading, error, isError } = useQuery({
    ...trpc.mail.verifyEmail.queryOptions({ id: messageId || '' }),
    enabled: !!messageId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });   

  if (!verificationResult?.isVerified || isLoading) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center">
          <CircleCheck className="h-4 w-4 text-blue-600 dark:text-blue-500 fill-blue-600 dark:fill-blue-500" />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-sm">
          Verified sender - This email passed email authentication (SPF/DKIM/DMARC) and BIMI validation
        </p>
      </TooltipContent>
    </Tooltip>
  );
};