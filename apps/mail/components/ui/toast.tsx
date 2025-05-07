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
          title: 'title flex-1 justify-center text-foreground text-sm leading-none',
          description: 'description',
          actionButton: 'action-button',
          cancelButton: 'cancel-button',
          closeButton: 'close-button',
          loading: 'px-4',
          loader: 'px-4',
          icon: 'px-4',
          content: 'px py-3',
          default:
            'w-96 px-1.5 py-1.5 bg-popover rounded-xl inline-flex items-center gap-2 overflow-visible dark:border-transparent',
        },
      }}
    />
  );
};

export default CustomToaster;
