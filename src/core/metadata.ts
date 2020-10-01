import type { QuartoConfig } from "./config.ts";
import { execProcess, ProcessResult } from "./process.ts";
import { resourcePath } from "./resources.ts";

export type Metadata = {
  quarto?: QuartoConfig;
  [key: string]: unknown;
};

export async function metadataFromMarkdown(
  markdown: string,
): Promise<Metadata> {
  if (markdown) {
    const result = await execProcess(pandocMetadataRunOptions([]), markdown);
    return handleMetadataResult(result);
  } else {
    return {};
  }
}

export async function metadataFromFile(file: string): Promise<Metadata> {
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
    const metadata = JSON.parse(result.stdout || "{}");
    return Promise.resolve((metadata || {}) as Metadata);
  } else {
    return Promise.reject(new Error(result.stderr));
  }
}
