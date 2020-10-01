import type { Metadata } from "./metadata.ts";
import { execProcess, ProcessResult } from "./process.ts";
import { resourcePath } from "./resources.ts";

export async function readMetadata(markdown: string): Promise<Metadata> {
  const result = await execProcess(pandocMetadataRunOptions([]), markdown);
  return handleMetadataResult(result);
}

export async function readMetadataFromFile(file: string): Promise<Metadata> {
  const result = await execProcess(pandocMetadataRunOptions([file]));
  return handleMetadataResult(result);
}

function pandocMetadataRunOptions(args: string[]): Deno.RunOptions {
  return {
    cmd: [
      "pandoc",
      "--template=" + resourcePath("metadata.template"),
      ...args,
    ],
    stdout: "piped",
    stderr: "piped",
  };
}

function handleMetadataResult(result: ProcessResult): Promise<Metadata> {
  if (result.success) {
    const metadata = JSON.parse(result.stdout || "");
    const quarto = metadata.quarto;
    return Promise.resolve((quarto || {}) as Metadata);
  } else {
    return Promise.reject(new Error(result.stderr));
  }
}
