import { redirect } from 'react-router';

export function loader() {
  throw redirect(`/mail/inbox`);
}
