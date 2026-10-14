// These clients expose DTO-only RPC methods. Each invocation owns its target and
// result until the DTO has been copied, including when invoked from waitUntil.
export function disposeRpc(value: unknown) {
  if (value && (typeof value === 'object' || typeof value === 'function')) {
    const disposable = value as { [Symbol.dispose]?: () => void };
    disposable[Symbol.dispose]?.();
  }
}

export function scopedRpc<T extends object>(acquire: () => Promise<object>): T {
  return new Proxy({} as T, {
    get(_target, method) {
      // A client is not a promise and must not trigger an RPC during assimilation.
      if (method === 'then' || typeof method !== 'string') return undefined;
      return async (...args: unknown[]) => {
        const target = await acquire();
        try {
          const call = Reflect.get(target, method) as (...args: unknown[]) => Promise<unknown>;
          const result = await Reflect.apply(call, target, args);
          try {
            return structuredClone(result);
          } finally {
            disposeRpc(result);
          }
        } finally {
          disposeRpc(target);
        }
      };
    },
  });
}
