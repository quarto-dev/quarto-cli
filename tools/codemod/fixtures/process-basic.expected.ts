import { args, cwd, execPath, exit, pid } from "../deno_ral/process.ts";
export function main() {
  if (args().length === 0) {
    console.log(cwd(), execPath(), pid());
    exit(1);
  }
}
