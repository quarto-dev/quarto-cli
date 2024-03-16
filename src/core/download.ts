/*
 * download.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { writeAll } from "io/write_all.ts";
import { progressBar } from "./console.ts";

export interface DownloadError extends Error {
  statusCode: number;
  statusText: string;
}

export async function downloadWithProgress(
  url: string | Response,
  msg: string,
  toFile: string,
) {
  // Fetch the data
  const response = await (typeof url === "string"
    ? fetch(
      url,
      {
        redirect: "follow",
      },
    )
    : url);

  // Write the data to a file
  if (response.status === 200 && response.body) {
    const pkgFile = await Deno.open(toFile, { create: true, write: true });

    const contentLength =
      (response.headers.get("content-length") || 0) as number;
    const contentLengthMb = contentLength / 1024 / 1024;

    const prog = progressBar(contentLengthMb, msg);

    let totalLength = 0;
    for await (const chunk of response.body) {
      await writeAll(pkgFile, chunk);
      totalLength = totalLength + chunk.length;
      if (contentLength > 0) {
        prog.update(
          totalLength / 1024 / 1024,
          `${(totalLength / 1024 / 1024).toFixed(1)}MB`,
        );
      }
    }
    prog.complete();
    pkgFile.close();
  } else {
    throw new Error(
      `download failed (HTTP status ${response.status} - ${response.statusText})`,
    );
  }
}
