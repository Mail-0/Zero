export async function loader({ request, params }: { request: Request; params: { id?: string } }) {
  const base = (import.meta as any).env?.VITE_PUBLIC_SERVER_URL as string | undefined;
  if (!base) return new Response("Server URL not configured", { status: 500 });
  const url = new URL(request.url);
  const upstream = `${base}/api/plugins/data/${encodeURIComponent(params.id!)}${url.search || ''}`;

  const res = await fetch(upstream, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') ?? '',
    },
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

export async function action({ request, params }: { request: Request; params: { id?: string } }) {
  const base = (import.meta as any).env?.VITE_PUBLIC_SERVER_URL as string | undefined;
  if (!base) return new Response("Server URL not configured", { status: 500 });
  const url = new URL(request.url);
  const upstream = `${base}/api/plugins/data/${encodeURIComponent(params.id!)}${url.search || ''}`;

  if (request.method !== 'PUT' && request.method !== 'DELETE') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const res = await fetch(upstream, {
    method: request.method,
    headers: {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      Accept: 'application/json',
      Cookie: request.headers.get('cookie') ?? '',
    },
    body: request.method === 'PUT' ? await request.text() : undefined,
  });

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
