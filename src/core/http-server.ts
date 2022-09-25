/*
* http-server.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { warning } from "log/mod.ts";

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
