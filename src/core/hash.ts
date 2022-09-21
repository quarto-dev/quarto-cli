/*
* hash.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import blueimpMd5 from "blueimpMd5";

export function md5Hash(content: string) {
  return blueimpMd5(content);
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
