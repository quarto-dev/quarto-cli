import { assert, assertStringIncludes } from "testing/asserts";
import { docs, quartoDevCmd } from "../../../../utils.ts";
import { existsSync } from "fs/exists";
import { juliaServerLogFile, juliaTransportFile } from "../../../../../src/execute/julia.ts";
import { sleep } from "../../../../../src/core/wait.ts";

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

Deno.test("closing an idling worker", () => {
  const close_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "close", sleepQmd]}
  ).outputSync();
  assertSuccess(close_output);
  assertStderrIncludes(close_output, "Worker closed successfully");

  const status_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assertSuccess(status_output);
  assertStdoutIncludes(status_output, "workers active: 0");
});

Deno.test("force-closing a running worker", async () => {
  // spawn a long-running command
  const render_cmd = new Deno.Command(
    quartoDevCmd(),
    {args: ["render", sleepQmd, "-P", "sleep_duration:30"]}
  ).output();

  await sleep(3000);

  const close_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "close", sleepQmd]}
  ).outputSync();
  assertStderrIncludes(close_output, "worker is busy");

  const status_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assertSuccess(status_output);
  assertStdoutIncludes(status_output, "workers active: 1");

  const force_close_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "close", "--force", sleepQmd]}
  ).outputSync();
  assertSuccess(force_close_output);
  assertStderrIncludes(force_close_output, "Worker force-closed successfully");

  const status_output_2 = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "status"]}
  ).outputSync();
  assertSuccess(status_output_2);
  assertStdoutIncludes(status_output_2, "workers active: 0");

  const render_output = await render_cmd;
  assertStderrIncludes(render_output, "File was force-closed during run")
});

Deno.test("log exists", () => {
  const log_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "log"]}
  ).outputSync();
  assertSuccess(log_output);
  assertStdoutIncludes(log_output, "Log started at");
});

Deno.test("stop the idling server", async () => {
  const stop_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "stop"]}
  ).outputSync();
  assertSuccess(stop_output);
  assertStderrIncludes(stop_output, "Server stopped");

  await sleep(2000); // allow a little bit of time for the server to stop and the log message to be written

  const log_output = new Deno.Command(
    quartoDevCmd(),
    {args: ["call", "engine", "julia", "log"]}
  ).outputSync();
  assertSuccess(log_output);
  assertStdoutIncludes(log_output, "Server stopped");
});
