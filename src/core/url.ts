/*
* url.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function joinUrl(baseUrl: string, path: string) {
  const joined = `${baseUrl}/${path}`;
  return joined.replace(/\/\//g, "/");
}
