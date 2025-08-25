import { redirect } from 'react-router';

export function clientLoader({ request }: { request: Request }) {
  const url = new URL(request.url);
  if (url.pathname === '/settings' || url.pathname === '/settings/') {
    throw redirect('/settings/general');
  }
  return null;
}
