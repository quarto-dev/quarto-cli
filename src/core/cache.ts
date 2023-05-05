/*
 * cache.ts
 *
 * provides a simple cache for expensive operations
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

export function cache<T>(f: () => Promise<T>): () => Promise<T> {
  let value: T | undefined = undefined;
  return async () => {
    if (value === undefined) {
      value = await f();
    }
    return value;
  };
}

export function cacheMap<K, V>(
  f: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const map = new Map<K, V>();
  return async (key: K) => {
    if (!map.has(key)) {
      map.set(key, await f(key));
    }
    return map.get(key)!;
  };
}
