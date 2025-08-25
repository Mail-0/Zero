export async function action({ request, params }: { request: Request; params: { id?: string } }) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const base = (import.meta as any).env?.VITE_PUBLIC_SERVER_URL as string | undefined;
  if (!base) return new Response('Server URL not configured', { status: 500 });
  const url = new URL(request.url);
  const upstream = `${base}/api/plugins/uninstall/${encodeURIComponent(params.id!)}${url.search || ''}`;

  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') ?? '',
    },
    body: await request.text(),
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
