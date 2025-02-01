// NOTE: THIS ISN'T A QUARTO RUN SCRIPT TO CUT DOWN ON THE OVERHEAD
import { resolve, dirname } from "https://deno.land/std/path/mod.ts";

const arg = Deno.args[0];
if (!arg) {
  console.error("Please provide a file name");
  Deno.exit(1);
}
const input = JSON.parse(Deno.readTextFileSync(arg));
Deno.chdir(input.cwd);
const runArgs = {
  cmd: [...input.args],
  env: {
    ...input.ourEnv,
    ...input.env,
    "QUARTO_FILTER_DEPENDENCY_FILE": "/dev/null",
  },
  cwd: input.cwd,
}
const params = {
  ...runArgs,
  stdout: "piped",
  stderr: "piped",
} as any;
const p = Deno.run(params);

const [status, stdout, stderr] = await Promise.all([
 p.status(),
 p.output(),
 p.stderrOutput()
]);
p.close();

if (status.code !== 0) {
  console.error(new TextDecoder().decode(stderr));
  Deno.exit(status.code);
}
