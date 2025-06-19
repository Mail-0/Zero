import { redirect } from 'react-router';

export function clientLoader() {
  throw redirect(`/mail/inbox`);
}
