import { EmailComposer } from '@/components/create/email-composer';

type Props = {};

export default function Page({}: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <EmailComposer onSendEmail={async () => {}} />
    </div>
  );
}
