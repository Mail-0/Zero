import { CircleCheck, Reply } from '../icons/icons';
import { useTranslations } from 'next-intl';

interface SuccessEmailToastProps {
    message: string;
}
export const SuccessEmailToast = ({ message }: SuccessEmailToastProps) => {
 
  return (
    <div className="w-96 pl-3 pr-1.5 py-1.5 bg-white dark:bg-[#2C2C2C] rounded-xl  inline-flex justify-center items-center gap-2 overflow-hidden border dark:border-none">
      <div className="w-4.5 h-4.5 relative">
        <CircleCheck className="h-4.5 w-4.5 fill-[#36B981]" />
      </div>
      <div className="flex-1 justify-center text-black dark:text-white text-sm leading-none">
        {message}
      </div>
      <div className="flex justify-start items-center gap-1.5 h-7">
        {/* <button className="h-7 px-1.5 bg-white dark:bg-[#424242] rounded-md  flex justify-center items-center gap-0.5 overflow-hidden">
          <div className="w-4 h-4 relative flex justify-center items-center">
            <Reply className="h-3 w-3 fill-[#A0A0A0]" />
          </div>
          <div className="pl-0.5 flex justify-center items-center gap-2.5">
            <div className="justify-start text-base-gray-950 text-sm font-['Inter'] leading-none">Unsend</div>
          </div>
        </button>
        <button className="h-7 px-1.5 bg-white dark:bg-[#424242] rounded-md flex justify-center items-center gap-0.5 overflow-hidden">
          <div className="pl-0.5 flex justify-center items-center gap-2.5">
            <div className="justify-start text-base-gray-950 text-sm leading-none">View email</div>
          </div>
        </button> */}
      </div>
    </div>
  );
};


