
import { join, dirname } from "../../../../src/deno_ral/path.ts"
import { ensureDirSync, existsSync } from "../../../../src/deno_ral/fs.ts"

import { Configuration } from "../config.ts";
import { Dependency } from "./dependencies.ts";
import { unTar } from "../../util/tar.ts";

export function typstGather(version: string): Dependency {
  const typstGatherRelease = (filename: string) => {
    return {
      filename,
      url: `https://github.com/quarto-dev/typst-gather/releases/download/v${version}/${filename}`,
      configure: async (config: Configuration, path: string) => {
        const file = config.os === "windows" ? "typst-gather.exe" : "typst-gather";
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          const dir = dirname(path);
          const targetDir = join(dir, config.arch);
          ensureDirSync(targetDir);

          // expand
          await unTar(path);

          // move the binary and cleanup
          const extractedPath = join(dir, file);
          Deno.renameSync(extractedPath, join(targetDir, file));
        }
        // When binaries are not vendored (e.g. building from source for a
        // package manager), the caller provides typst-gather. It is only needed
        // at render time via QUARTO_TYPST_GATHER or the tools directory, so
        // don't require it at configure time.
      }
    }
  }

  return {
    name: "typst-gather",
    bucket: "typst-gather",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": typstGatherRelease("typst-gather-x86_64-pc-windows-msvc.zip"),
        "linux": typstGatherRelease("typst-gather-x86_64-unknown-linux-gnu.tar.gz"),
        "darwin": typstGatherRelease("typst-gather-x86_64-apple-darwin.tar.gz"),
      },
      "aarch64": {
        "linux": typstGatherRelease("typst-gather-aarch64-unknown-linux-gnu.tar.gz"),
        "darwin": typstGatherRelease("typst-gather-aarch64-apple-darwin.tar.gz"),
      }
    }
  }
}
