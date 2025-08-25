 import { redirect } from 'react-router';

export function clientLoader() {
  return Response.redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/mail/inbox`);
}

export async function loader() {
  return redirect(`${import.meta.env.VITE_PUBLIC_APP_URL}/mail/inbox`);
}
