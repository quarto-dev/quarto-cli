
import { join, dirname, basename } from "path/mod.ts"
import { existsSync } from "fs/mod.ts"

import { Configuration } from "../config.ts";
import { Dependency } from "./dependencies.ts";
import { which } from "../../../../src/core/path.ts";
import { unTar } from "../../util/tar.ts";

export function typst(version: string ): Dependency {
  const typst_release = (filename: string ) => {
    return {
      filename,
      url: `https://github.com/typst/typst/releases/download/v${version}/${filename}`,
      configure: async(config: Configuration, path: string) => {
        const file = config.os === "windows" ? "typst.exe" : "typst";
        const archiveExt = config.os === "windows" ? ".zip" : ".tar.xz";
        const vendor = Deno.env.get("QUARTO_VENDOR_BINARIES");
        if (vendor === undefined || vendor === "true") {
          // establish archive expand dir and remove existing if necessary
          const dir = dirname(path);
          const archiveDir = basename(path, archiveExt);
          const typstDir = join(dir, archiveDir);
          const cleanup = () => {
            if (existsSync(typstDir)) {
              Deno.removeSync(typstDir, { recursive: true });
            }
          }
          cleanup();

          // expand
          await unTar(path);

          // move the file and cleanup
          try {
            const extractedPath = join(typstDir, file);
            Deno.renameSync(extractedPath, join(dir, file));
          } finally {
            cleanup();
          }
        } else {
          // verify that the binary is on PATH, but otherwise don't do anything
          if (which(file) === undefined) {
            throw new Error(
              `${file} is not on PATH. Please install it and add it to PATH.`,
            );
          }
        }
      }
    }
  }

  return {
    name: "Typst",
    bucket: "typst",
    version,
    architectureDependencies: {
      "x86_64": {
        "windows": typst_release("typst-x86_64-pc-windows-msvc.zip"),
        "linux": typst_release("typst-x86_64-unknown-linux-musl.tar.xz"),
        "darwin": typst_release("typst-x86_64-apple-darwin.tar.xz"),  
      },
      "aarch64": {
        "linux": typst_release("typst-aarch64-unknown-linux-musl.tar.xz"),
        "darwin": typst_release("typst-aarch64-apple-darwin.tar.xz")
      }
    }
  }
}


