import { assert, assertStringIncludes } from "testing/asserts";
import { docs, quartoDevCmd } from "../../../../utils.ts";
import { existsSync } from "fs/exists";
import { juliaTransportFile } from "../../../../../src/execute/julia.ts";

const sleepQmd = docs("call/engine/julia/sleep.qmd");
assert(existsSync(sleepQmd));

// make sure we don't have a server process running by sending a kill command
// and then also try to remove the transport file in case one still exists
const killcmd = new Deno.Command(
  quartoDevCmd(),
  {args: ["call", "engine", "julia", "kill"]}
).outputSync();
assert(killcmd.success);
try {
  await Deno.remove(juliaTransportFile());
} catch {
}

Deno.test("kill without server running", () => {
  const output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "kill"]}
  ).outputSync();
  assert(output.success);
  const stderr = new TextDecoder().decode(output.stderr);
  assertStringIncludes(stderr, "Julia control server is not running.");
});

Deno.test("status without server running", () => {
  const output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assert(output.success);
  const stderr = new TextDecoder().decode(output.stderr);
  assertStringIncludes(stderr, "Julia control server is not running.");
});

Deno.test("status with server and worker running", () => {
  const render_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["render", sleepQmd, "-P", "sleep_duration:0", "--execute-daemon", "60"]}
  ).outputSync();
  assert(render_output.success);

  const status_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  const stdout = new TextDecoder().decode(status_output.stdout);
  console.log(stdout);
  const stderr = new TextDecoder().decode(status_output.stderr);
  console.log(stderr);
  assert(status_output.success);
  assertStringIncludes(stdout, "workers active: 1");
});

Deno.test("log exists", () => {
  const log_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "log"]}
  ).outputSync();
  assert(log_output.success);
  const stdout_log = new TextDecoder().decode(log_output.stdout);
  assertStringIncludes(stdout_log, "Log started at");
});