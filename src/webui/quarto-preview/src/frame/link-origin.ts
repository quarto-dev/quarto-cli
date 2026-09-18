/*
 * link-origin.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

export function parseOrigin(
  value: string,
  base?: string,
): string | undefined {
  try {
    return new URL(value, base).origin;
  } catch {
    return undefined;
  }
}

// A link is local when it resolves to the origin the browser is on. The
// server-provided origin is also accepted, since it is what the preview
// server inferred from the request; behind a proxy the two differ.
export function isLocalHref(
  href: string,
  browserHref: string,
  serverOrigin: string,
): boolean {
  const target = parseOrigin(href, browserHref);
  if (target === undefined) {
    return false;
  }
  return target === parseOrigin(browserHref) ||
    target === parseOrigin(serverOrigin);
}
