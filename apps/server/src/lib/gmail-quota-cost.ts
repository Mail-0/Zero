const costs: Record<string, number> = {
  getProfile: 1,
  watch: 100,
  stop: 50,
  'history.list': 2,
  'threads.list': 10,
  'threads.get': 40,
  'threads.modify': 10,
  'threads.delete': 20,
  'threads.trash': 20,
  'threads.untrash': 10,
  'messages.list': 5,
  'messages.get': 20,
  'messages.modify': 5,
  'messages.delete': 10,
  'messages.send': 100,
  'messages.batchModify': 50,
  'messages.batchDelete': 50,
  'messages.trash': 20,
  'messages.untrash': 5,
  'messages.insert': 25,
  'messages.import': 25,
  'messages.attachments.get': 20,
  'drafts.list': 5,
  'drafts.get': 20,
  'drafts.create': 10,
  'drafts.update': 15,
  'drafts.delete': 10,
  'drafts.send': 100,
  'labels.list': 1,
  'labels.get': 1,
  'labels.create': 5,
  'labels.update': 5,
  'labels.delete': 5,
};

export function gmailQuotaCost(url: string | URL, method = 'GET'): number | undefined {
  const parsed = new URL(url);
  if (!['gmail.googleapis.com', 'www.googleapis.com'].includes(parsed.hostname)) return undefined;
  const match = parsed.pathname.match(/^\/(?:upload\/)?gmail\/v1\/users\/[^/]+\/?(.*)$/);
  if (!match) return undefined;
  const parts = match[1].split('/').filter(Boolean);
  if (!parts.length || parts[0] === 'profile') return costs.getProfile;
  if (parts[0] === 'watch' || parts[0] === 'stop') return costs[parts[0]];
  if (parts[0] === 'history') return costs['history.list'];
  if (parts[0] === 'settings') {
    // Every currently used settings read is 1 unit; conservative fallback for writes.
    return method.toUpperCase() === 'GET' ? 1 : 100;
  }
  if (parts[2] === 'attachments') return costs['messages.attachments.get'];
  const resource = parts[0];
  const actions = [
    'batchModify',
    'batchDelete',
    'send',
    'modify',
    'trash',
    'untrash',
    'import',
    'insert',
  ];
  const action = actions.find((value) => parts.at(-1) === value);
  const operation =
    action ??
    (method.toUpperCase() === 'GET'
      ? parts.length === 1
        ? 'list'
        : 'get'
      : method.toUpperCase() === 'DELETE'
        ? 'delete'
        : method.toUpperCase() === 'POST'
          ? 'create'
          : 'update');
  return costs[`${resource}.${operation}`] ?? 100;
}
