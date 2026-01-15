/*
 * http-server.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export function handleHttpRequests(
  options: {
    port?: number;
    hostname?: string;
    handler: (req: Request) => Promise<Response>;
  },
) {
  const abortController = new AbortController();
  const server = Deno.serve({ ...options, signal: abortController.signal });
  return {
    server,
    stop: () => {
      abortController.abort();
    },
  };
}
