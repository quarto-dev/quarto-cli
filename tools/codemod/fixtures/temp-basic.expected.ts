import { makeTempDirSync, type TempOptions } from "../deno_ral/temp.ts";
export function scratch(options?: TempOptions): string {
  return makeTempDirSync({ prefix: "q-", ...options });
}
