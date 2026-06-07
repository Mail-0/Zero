import { redirect } from 'react-router';

export function clientLoader() {
  throw redirect(`/settings/user-information`);
}
