import { redirect } from 'react-router';

export function clientLoader() {
  throw redirect('/login');
}

export default function IndexPage() {
  return null;
}
