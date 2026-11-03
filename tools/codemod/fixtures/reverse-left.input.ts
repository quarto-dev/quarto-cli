import { args, exit } from "../deno_ral/process.ts";

export const argv = args;
export function stop() {
  exit(1);
}
