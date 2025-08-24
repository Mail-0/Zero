export function clientLoader() {
  throw new Response('Not Found', { status: 404 });
}

export default function NotFound() {
  return null;
}
