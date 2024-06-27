/*
* http-server.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { warning } from "../deno_ral/log.ts";

export async function handleHttpRequests(
  listener: Deno.Listener,
  handler: (req: Request) => Promise<Response>,
) {
  for await (const conn of listener) {
    (async () => {
      try {
        for await (const { request, respondWith } of Deno.serveHttp(conn)) {
          await respondWith(handler(request));
        }
      } catch (err) {
        warning(err.message);
        try {
          conn.close();
        } catch {
          //
        }
      }
    })();
  }
}
