/*
 * types.ts
 *
 * Types for ./cache.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export type ProjectCacheKey = string[];

export type DiskCacheEntry = {
  hash: string;
  type: "buffer" | "string";
};
export type ImmediateStringCacheEntry = {
  value: string;
  type: "string-immediate";
};
export type ImmediateBufferCacheEntry = {
  value: Uint8Array;
  type: "buffer-immediate";
};
export type CacheIndexEntry =
  | DiskCacheEntry
  | ImmediateStringCacheEntry
  | ImmediateBufferCacheEntry;

export type ProjectCache = {
  addSmallString(key: ProjectCacheKey, value: string): Promise<void>;
  addSmallBuffer(key: ProjectCacheKey, value: Uint8Array): Promise<void>;
  addBuffer: (key: ProjectCacheKey, value: Uint8Array) => Promise<void>;
  addString: (key: ProjectCacheKey, value: string) => Promise<void>;

  getSmallBuffer: (key: ProjectCacheKey) => Promise<Uint8Array | null>;
  getSmallString: (key: ProjectCacheKey) => Promise<string | null>;
  getBuffer: (key: ProjectCacheKey) => Promise<Uint8Array | null>;
  getString: (key: ProjectCacheKey) => Promise<string | null>;

  get: (key: ProjectCacheKey) => Promise<CacheIndexEntry | null>;

  close: () => void;
  clear: () => Promise<void>;
};
