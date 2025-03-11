import { assert, assertStringIncludes } from "testing/asserts";
import { docs, quartoDevCmd } from "../../../../utils.ts";
import { existsSync } from "fs/exists";
import { juliaServerLogFile, juliaTransportFile } from "../../../../../src/execute/julia.ts";

const sleepQmd = docs("call/engine/julia/sleep.qmd");
assert(existsSync(sleepQmd));

function assertSuccess(output: Deno.CommandOutput) {
  if (!output.success) {
    console.error("Command failed:");
    console.error("stdout:\n" + new TextDecoder().decode(output.stdout));
    console.error("stderr:\n" + new TextDecoder().decode(output.stderr));
    throw new Error("Command execution was not successful");
  }
}

function assertStdoutIncludes(output: Deno.CommandOutput, str: string) {
  assertStringIncludes(new TextDecoder().decode(output.stdout), str);
}
function assertStderrIncludes(output: Deno.CommandOutput, str: string) {
  assertStringIncludes(new TextDecoder().decode(output.stderr), str);
}

// make sure we don't have a server process running by sending a kill command
// and then also try to remove the transport file in case one still exists
const killcmd = new Deno.Command(
  quartoDevCmd(),
  {args: ["call", "engine", "julia", "kill"]}
).outputSync();
assertSuccess(killcmd);
try {
  await Deno.remove(juliaTransportFile());
} catch {
}

Deno.test("kill without server running", () => {
  const output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "kill"]}
  ).outputSync();
  assertSuccess(output);
  assertStderrIncludes(output, "Julia control server is not running.");
});

Deno.test("status without server running", () => {
  const output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assertSuccess(output);
  assertStderrIncludes(output, "Julia control server is not running.");
});

try {
  await Deno.remove(juliaServerLogFile());
} catch {
}

Deno.test("log file doesn't exist", () => {
  const log_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "log"]}
  ).outputSync();
  assertSuccess(log_output);
  assertStderrIncludes(log_output, "Server log file doesn't exist");
});

Deno.test("status with server and worker running", () => {
  const render_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["render", sleepQmd, "-P", "sleep_duration:0", "--execute-daemon", "60"]}
  ).outputSync();
  assertSuccess(render_output);

  const status_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assertSuccess(status_output);
  assertStdoutIncludes(status_output, "workers active: 1");
});

Deno.test("log exists", () => {
  const log_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "log"]}
  ).outputSync();
  assertSuccess(log_output);
  assertStdoutIncludes(log_output, "Log started at");
});