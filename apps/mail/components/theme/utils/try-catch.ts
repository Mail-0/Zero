export async function tryCatch<T, E = Error>(promise: T | Promise<T>) {
  try {
    const data = await promise;
    return [null, data] as const;
  } catch (error) {
    return [error as E, null] as const;
  }
}
