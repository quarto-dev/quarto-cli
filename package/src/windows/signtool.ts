import { info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { decodeBase64 as base64decode } from "encoding/base64.ts";

import { runCmd } from "../util/cmd.ts";

const kSignToolPath =
  "C:/Program Files (x86)/Windows Kits/10/bin/10.0.17763.0/x86/signtool.exe";

export interface SigningDescriptor {
  file: string; // The file that is signed
  desc?: string; // Description for this file
}

export async function signtool(
  descriptors: SigningDescriptor[],
  pfx: string,
  pw: string,
  workingDir: string,
) {
  // add \d descr
  // Create the pfx file
  const pfxFile = join(workingDir, "sign.pfx");
  const pfxContents = base64decode(pfx);
  Deno.writeFileSync(pfxFile, pfxContents, { create: true });

  //
  try {
    const args = ["Sign", "/f", pfxFile, "/p", pw];
    for (const descriptor of descriptors) {
      const file = descriptor.file;
      const desc = descriptor.desc;
      const fileArgs = desc ? ["/d", desc, file] : [file];

      info(`> Signing ${file}`);
      const result = await runCmd(kSignToolPath, [...args, ...fileArgs]);
      if (!result.status.success) {
        console.error(`Failed to sign ${file}`);
        return Promise.reject();
      }
    }
  } finally {
    // Clean up the pfx file as soon as we're complete
    Deno.removeSync(pfxFile);
  }
}
