export async function loader({ request, params }: { request: Request; params: { id?: string } }) {
  const base = (import.meta as any).env?.VITE_PUBLIC_SERVER_URL as string | undefined;
  if (!base) return new Response("Server URL not configured", { status: 500 });
  const url = new URL(request.url);
  const upstream = `${base}/api/plugins/settings/${encodeURIComponent(params.id!)}${url.search || ''}`;

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
  const upstream = `${base}/api/plugins/settings/${encodeURIComponent(params.id!)}${url.search || ''}`;

  const res = await fetch(upstream, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
