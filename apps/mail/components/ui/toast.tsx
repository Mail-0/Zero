import {
  CircleCheck,
  ExclamationCircle2,
  ExclamationTriangle,
  InfoCircle,
} from '@/components/icons/icons';
import { Toaster } from 'sonner';
import React from 'react';

type Props = {};

const CustomToaster = (props: Props) => {
  return (
    <Toaster
      position="bottom-center"
      icons={{
        success: <CircleCheck className="h-4.5 w-4.5 border-none fill-[#36B981]" />,
        error: <ExclamationCircle2 className="h-4.5 w-4.5 fill-[#FF0000]" />,
        warning: <ExclamationTriangle className="h-4.5 w-4.5 fill-[#FFC107]" />,
        info: <InfoCircle className="h-4.5 w-4.5 fill-[#5767fb]" />,
      }}
      toastOptions={{
        classNames: {
          title: 'title flex-1 justify-center text-black dark:text-white text-sm leading-none',
          description: 'text-black dark:text-white text-xs',
          toast: 'px-3',
          actionButton: 'bg-[#DBDBDB] text-lg',
          cancelButton: 'bg-[#DBDBDB] text-lg',
          closeButton: 'bg-[#DBDBDB] text-lg',
          loading: 'pl-3 pr-2',
          loader: 'pl-3 pr-2',
          icon: 'pl-3 pr-2',
          content: 'pl-2',
          default:
            'w-96 px-1.5 bg-white dark:bg-[#2C2C2C] rounded-xl inline-flex items-center gap-2 overflow-visible border dark:border-none',
        },
      }}
    />
  );
};

export default CustomToaster;
