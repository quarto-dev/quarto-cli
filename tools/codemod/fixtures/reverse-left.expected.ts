import { args } from "../deno_ral/process.ts";

export const argv = args;
export function stop() {
  Deno.exit(1);
}
