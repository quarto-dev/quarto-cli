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
    // Deno.serve logs "Listening on ..." unless a callback is supplied; pass a
    // no-op to serve quietly.
    onListen?: (params: { hostname: string; port: number }) => void;
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
