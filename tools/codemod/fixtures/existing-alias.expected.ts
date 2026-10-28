import { join } from "../deno_ral/path.ts";
import { arch, os as platformOs } from "../deno_ral/platform.ts";

export function binDir(base: string): string {
  if (platformOs === "linux") {
    return join(base, `bin/${arch}-linux`);
  }
  return platformOs;
}
