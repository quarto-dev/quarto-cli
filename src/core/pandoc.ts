import type { Metadata } from "./metadata.ts";
import { execProcess } from "./process.ts";
import { resourcePath } from "./resources.ts";

export async function readMetadata(file: string): Promise<Metadata> {
  const result = await execProcess({
    cmd: [
      "pandoc",
      "--template=" + resourcePath("metadata.template"),
      file,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  if (result.success) {
    const metadata = JSON.parse(result.stdout || "");
    const quarto = metadata.quarto;
    return (quarto || {}) as Metadata;
  } else {
    return Promise.reject(new Error(result.stderr));
  }
}
