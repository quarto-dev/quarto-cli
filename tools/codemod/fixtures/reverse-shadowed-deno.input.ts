import { type FileInfo, statSync } from "../deno_ral/fs.ts";
import { os } from "../deno_ral/platform.ts";
export function viaParam(Deno: { statSync(p: string): unknown }, p: string) {
  return statSync(p);
}
export function osVia(Deno: unknown) {
  return { os };
}
export function info(Deno: unknown, p: string): FileInfo {
  return statSync(p) as FileInfo;
}
