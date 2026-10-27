/** No data does not necessarily mean loading: failed/empty reads need a retry UI. */
export function getMailLoadState(query: {
  hasData: boolean;
  isError: boolean;
  isPending: boolean;
  isFetching: boolean;
}): 'ready' | 'loading' | 'error' | 'unavailable' {
  if (query.hasData) return 'ready';
  if (query.isFetching) return 'loading';
  if (query.isError) return 'error';
  if (query.isPending) return 'loading';
  return 'unavailable';
}
