import {
  CircleCheck,
  ExclamationCircle2,
  ExclamationTriangle,
  InfoCircle,
} from '@/components/icons/icons';
import { Toaster as SonnerToaster } from 'sonner';
import { Loader2 } from 'lucide-react';

// Shared by every toast button. `shrink-0` + `whitespace-nowrap` keep the label on a
// single line so the toast's text content wraps instead of the button.
const toastButton =
  'inline-flex h-7 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md! border px-2.5 text-xs! font-medium dark:border-none bg-[#E0E0E0]! dark:bg-[#424242]! text-black! dark:text-white! pointer-events-auto cursor-pointer';

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
          title: 'title text-black! dark:text-white! text-sm leading-snug',
          description: 'text-black! dark:text-white! text-xs leading-snug',
          toast: 'p-1',
          actionButton: `${toastButton} mr-1.5`,
          cancelButton: toastButton,
          closeButton: toastButton,
          loading: 'pl-3 -mr-3 loading',
          loader: 'pl-3 loader -mr-3',
          icon: 'pl-3 icon mr-2 shrink-0',
          // min-w-0 lets long titles/descriptions wrap rather than push the action button.
          content: 'flex min-w-0 flex-1 flex-col gap-0.5 p-1.5 pl-2',
          default:
            'w-96 p-1.5 bg-white dark:bg-[#2C2C2C] rounded-xl inline-flex items-center gap-2 overflow-visible border dark:border-none',
        },
      }}
    />
  );
};

export default Toaster;
