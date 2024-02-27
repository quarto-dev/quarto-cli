/*
* github.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";

export interface GithubRelease {
  version: string;
  filename: string;
  repo: string;
}

export async function download(
  release: GithubRelease,
  dir: string,
) {
  const url =
    `https://github.com/${release.repo}/releases/download/${release.version}/${release.filename}"`;

  const response = await fetch(url);
  const blob = await response.blob();

  const bytes = await blob.arrayBuffer();
  const data = new Uint8Array(bytes);

  Deno.writeFileSync(join(dir, release.filename), data);
}
