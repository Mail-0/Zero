'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';
import { useEffect } from 'react';
import { toast } from 'sonner';

const errorMessages = ['required_scopes_missing'] as const;

const errorToasts = ['early_access_required', 'unauthorized'] as const;

type ErrorToast = (typeof errorToasts)[number];
type ErrorMessage = (typeof errorMessages)[number];

const isErrorToast = (error: string): error is (typeof errorToasts)[number] =>
  errorToasts.includes(error as ErrorToast);

const isErrorMessage = (error: string): error is (typeof errorMessages)[number] =>
  errorMessages.includes(error as ErrorMessage);

const ErrorMessage = () => {
  const [error] = useQueryState('error');
  const t = useTranslations();

  useEffect(() => {
    if (error && isErrorToast(error)) {
      toast.error(t(`errorMessages.${error}`));
    }
  });

  if (!error || !isErrorMessage(error)) {
    return null;
  }

  return (
    <div className="border-red/10 bg-red/5 min-w-0 max-w-fit shrink overflow-hidden break-words rounded-lg border p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center">
        <TriangleAlert size={28} />
        <p className="ml-2 text-sm text-black/80 dark:text-white/80">
          {t(`errorMessages.${error}`)}
        </p>
      </div>
    </div>
  );
};

export default ErrorMessage;
