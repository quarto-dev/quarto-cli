import { os } from "../deno_ral/platform.ts";
import { cwd } from "../deno_ral/process.ts";
export { os };
export { cwd as currentDir };
export const a = Deno.build.arch;
