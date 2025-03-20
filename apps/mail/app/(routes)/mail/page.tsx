import { MailLayout } from '@/components/mail/mail';

export default async function MailPage() {
  return (
    <div className="dark:bg-sidebar w-full bg-white">
      <div className="flex-col md:m-2 md:flex md:rounded-md md:border dark:bg-[#090909] dark:text-gray-100">
        <MailLayout />
      </div>
    </div>
  );
}
