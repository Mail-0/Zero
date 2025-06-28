export function ok<T>(data: T, count?: number) {
  return { success: true, data, count } as const;
}

export function fail(message = 'Internal Server Error', status = 500) {
  return { success: false, error: message, message } as const;
}