import { assert, assertStringIncludes } from "testing/asserts";
import { docs, quartoDevCmd } from "../../../../utils.ts";
import { existsSync } from "fs/exists";
import { sleep } from "../../../../../src/core/wait.ts";
import { quartoRuntimeDir } from "../../../../../src/core/appdirs.ts";
import { join } from "../../../../../src/deno_ral/path.ts";

const juliaTestDir = docs("call/engine/julia");
const sleepQmd = "sleep.qmd";
assert(existsSync(docs("call/engine/julia/sleep.qmd")));

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

Deno.test("julia engine", async (t) => {
  // Setup: Clean up any leftover server state before running tests
  const killcmd = new Deno.Command(
    quartoDevCmd(),
    { args: ["call", "engine", "julia", "kill"], cwd: juliaTestDir },
  ).outputSync();
  assertSuccess(killcmd);

  const transportFile = join(quartoRuntimeDir("julia"), "julia_transport.txt");
  const logFile = join(quartoRuntimeDir("julia"), "julia_server_log.txt");

  try {
    await Deno.remove(transportFile);
  } catch {
    // File might not exist, that's okay
  }

  try {
    await Deno.remove(logFile);
  } catch {
    // File might not exist, that's okay
  }

  // Now run all the actual tests as steps
  await t.step("kill without server running", () => {
    const output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "kill"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(output);
    assertStderrIncludes(output, "Julia control server is not running.");
  });

  await t.step("status without server running", () => {
    const output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(output);
    assertStderrIncludes(output, "Julia control server is not running.");
  });

  await t.step("log file doesn't exist", () => {
    const log_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStderrIncludes(log_output, "Server log file doesn't exist");
  });

  await t.step("status with server and worker running", () => {
    const render_output = new Deno.Command(
      quartoDevCmd(),
      {
        args: [
          "render",
          sleepQmd,
          "-P",
          "sleep_duration:0",
          "--execute-daemon",
          "60",
        ],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertSuccess(render_output);

    const status_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 1");
  });

  await t.step("closing an idling worker", () => {
    const close_output = new Deno.Command(
      quartoDevCmd(),
      {
        args: ["call", "engine", "julia", "close", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertSuccess(close_output);
    assertStderrIncludes(close_output, "Worker closed successfully");

    const status_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 0");
  });

  await t.step("force-closing a running worker", async () => {
    // spawn a long-running command
    const render_cmd = new Deno.Command(
      quartoDevCmd(),
      {
        args: ["render", sleepQmd, "-P", "sleep_duration:30"],
        cwd: juliaTestDir,
      },
    ).output();

    await sleep(3000);

    const close_output = new Deno.Command(
      quartoDevCmd(),
      {
        args: ["call", "engine", "julia", "close", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertStderrIncludes(close_output, "worker is busy");

    const status_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 1");

    const force_close_output = new Deno.Command(
      quartoDevCmd(),
      {
        args: ["call", "engine", "julia", "close", "--force", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertSuccess(force_close_output);
    assertStderrIncludes(force_close_output, "Worker force-closed successfully");

    const status_output_2 = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output_2);
    assertStdoutIncludes(status_output_2, "workers active: 0");

    const render_output = await render_cmd;
    assertStderrIncludes(render_output, "File was force-closed during run");
  });

  await t.step("log exists", () => {
    const log_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStdoutIncludes(log_output, "Log started at");
  });

  await t.step("stop the idling server", async () => {
    const stop_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "stop"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(stop_output);
    assertStderrIncludes(stop_output, "Server stopped");

    await sleep(2000); // allow a little bit of time for the server to stop and the log message to be written

    const log_output = new Deno.Command(
      quartoDevCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStdoutIncludes(log_output, "Server stopped");
  });
});
