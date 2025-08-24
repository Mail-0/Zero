import {
  CircleCheck,
  ExclamationCircle2,
  ExclamationTriangle,
  InfoCircle,
} from '@/components/icons/icons';
import { Toaster as SonnerToaster } from 'sonner';
import { Loader2 } from 'lucide-react';

const Toaster = () => {
  return (
    <SonnerToaster
      position="bottom-center"
      icons={{
        success: <CircleCheck className="h-4.5 w-4.5 border-none fill-[#36B981]" />,
        error: <ExclamationCircle2 className="h-4.5 w-4.5 fill-[#FF0000]" />,
        warning: <ExclamationTriangle className="h-4.5 w-4.5 fill-[#FFC107]" />,
        info: <InfoCircle className="h-4.5 w-4.5 fill-[#5767fb]" />,
        loading: <Loader2 className="stroke-muted-foreground h-[17px] w-[17px] animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          title: 'title flex-1 justify-center text-black! dark:text-white! text-sm leading-none',
          description: 'text-black! dark:text-white! text-xs',
          toast: 'p-1',
          actionButton:
            'inline-flex h-5 items-center justify-center gap-1 overflow-hidden rounded-md! border px-1 text-xs dark:border-none bg-[#E0E0E0]! dark:bg-[#424242]! pointer-events-auto cursor-pointer',
          cancelButton:
            'inline-flex h-5 items-center justify-center gap-1 overflow-hidden rounded-md! border px-1 text-xs dark:border-none bg-[#E0E0E0]! dark:bg-[#424242]!',
          closeButton:
            'inline-flex h-5 items-center justify-center gap-1 overflow-hidden rounded-md! border px-1 text-xs dark:border-none bg-[#E0E0E0]! dark:bg-[#424242]!',
          loading: 'pl-3 -mr-3 loading',
          loader: 'pl-3 loader -mr-3',
          icon: 'pl-3 icon mr-2',
          content: 'flex-1 p-1.5 pl-2',
          default:
            'w-full p-1.5 bg-white dark:bg-[#2C2C2C] rounded-xl flex items-center gap-2 overflow-visible border dark:border-none',
        },
      }}
    />
  );
};

export default Toaster;
