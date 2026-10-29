import { join } from "../deno_ral/path.ts";

export function binDir(base: string): string {
  if (Deno.build.os === "linux") {
    return join(base, `bin/${Deno.build.arch}-linux`);
  }
  return Deno.build.os;
}
