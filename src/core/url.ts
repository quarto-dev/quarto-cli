/*
* url.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function joinUrl(baseUrl: string, path: string) {
  const baseHasSlash = baseUrl.endsWith("/");
  const pathHasSlash = path.startsWith("/");

  if (baseHasSlash && pathHasSlash) {
    return `${baseUrl}${path.slice(1)}`;
  } else if (!baseHasSlash && !pathHasSlash) {
    return `${baseUrl}/${path}`;
  } else {
    return `${baseUrl}${path}`;
  }
}
