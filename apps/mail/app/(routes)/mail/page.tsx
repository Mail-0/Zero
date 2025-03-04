import { MailLayout } from "@/components/mail/mail";

export default async function MailPage() {
  return (
    <div className="w-full bg-white dark:bg-sidebar">
      <div className="flex-col dark:bg-[#090909] dark:text-gray-100 md:m-2 md:flex md:rounded-md md:border">
        <MailLayout />
      </div>
    </div>
  );
}
