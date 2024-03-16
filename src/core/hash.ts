/*
 * hash.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { crypto } from "crypto/mod.ts";
import blueimpMd5 from "blueimpMd5";

export function md5Hash(content: string) {
  return blueimpMd5(content);
}

export function md5HashBytes(content: Uint8Array) {
  const buffer = crypto.subtle.digestSync(
    "MD5",
    content,
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Simple insecure hash for a string
export function insecureHash(content: string) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return new Uint32Array([hash])[0].toString(36);
}
