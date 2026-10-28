import { type FileInfo, readTextFileSync } from "../deno_ral/fs.ts";
export function readVia(
  Deno: { readTextFileSync(path: string): string },
  path: string,
): string {
  return Deno.readTextFileSync(path);
}

export function info(Deno: { FileInfo: unknown }, f: Deno.FileInfo): unknown {
  return f;
}

export function readReal(path: string): string {
  return readTextFileSync(path);
}

export function realInfo(f: FileInfo): unknown {
  return f;
}
