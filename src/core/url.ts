/*
* url.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ensureTrailingSlash, pathWithForwardSlashes } from "./path.ts";

export function isHttpUrl(url: string) {
  return /^https?:/i.test(url);
}

export function joinUrl(baseUrl: string, path: string) {
  const baseHasSlash = baseUrl.endsWith("/");

  path = pathWithForwardSlashes(path);
  const pathHasSlash = path.startsWith("/");

  if (baseHasSlash && pathHasSlash) {
    return `${baseUrl}${path.slice(1)}`;
  } else if (!baseHasSlash && !pathHasSlash) {
    return `${baseUrl}/${path}`;
  } else {
    return `${baseUrl}${path}`;
  }
}

export function ensureProtocolAndTrailingSlash(url: string) {
  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }
  url = ensureTrailingSlash(url);
  return url;
}
