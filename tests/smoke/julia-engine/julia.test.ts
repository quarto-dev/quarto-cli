import { assert, assertStringIncludes } from "jsr:@std/assert";
import { existsSync } from "jsr:@std/fs/exists";
import { join } from "jsr:@std/path";

const isWindows = Deno.build.os === "windows";
function quartoCmd(): string {
  return isWindows ? "quarto.cmd" : "quarto";
}
function docs(path: string): string {
  return join("docs", path);
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolve the quarto runtime dir for Julia (where transport/log files live).
// Mirrors quarto's quartoRuntimeDir("julia").
function quartoRuntimeDir(): string {
  let base: string;
  switch (Deno.build.os) {
    case "darwin":
      base = join(Deno.env.get("HOME")!, "Library", "Caches", "quarto");
      break;
    case "windows":
      base = join(Deno.env.get("LOCALAPPDATA")!, "quarto");
      break;
    default: {
      const xdgRuntime = Deno.env.get("XDG_RUNTIME_DIR");
      if (xdgRuntime) {
        base = join(xdgRuntime, "quarto");
      } else {
        const cacheHome = Deno.env.get("XDG_CACHE_HOME") ?? join(Deno.env.get("HOME")!, ".cache");
        base = join(cacheHome, "quarto");
      }
      break;
    }
  }
  return join(base, "julia");
}

const juliaTestDir = docs("julia-engine/sleep");
const sleepQmd = "sleep.qmd";
assert(existsSync(join(juliaTestDir, sleepQmd)));

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
    quartoCmd(),
    { args: ["call", "engine", "julia", "kill"], cwd: juliaTestDir },
  ).outputSync();
  assertSuccess(killcmd);

  const transportFile = join(quartoRuntimeDir(), "julia_transport.txt");
  const logFile = join(quartoRuntimeDir(), "julia_server_log.txt");

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

  await t.step("kill without server running", () => {
    const output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "kill"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(output);
    assertStderrIncludes(output, "Julia control server is not running.");
  });

  await t.step("status without server running", () => {
    const output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(output);
    assertStderrIncludes(output, "Julia control server is not running.");
  });

  await t.step("log file doesn't exist", () => {
    const log_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStderrIncludes(log_output, "Server log file doesn't exist");
  });

  await t.step("status with server and worker running", () => {
    const render_output = new Deno.Command(
      quartoCmd(),
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
      quartoCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 1");
  });

  await t.step("closing an idling worker", () => {
    const close_output = new Deno.Command(
      quartoCmd(),
      {
        args: ["call", "engine", "julia", "close", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertSuccess(close_output);
    assertStderrIncludes(close_output, "Worker closed successfully");

    const status_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 0");
  });

  await t.step("force-closing a running worker", async () => {
    const render_cmd = new Deno.Command(
      quartoCmd(),
      {
        args: ["render", sleepQmd, "-P", "sleep_duration:30"],
        cwd: juliaTestDir,
      },
    ).output();

    await delay(3000);

    const close_output = new Deno.Command(
      quartoCmd(),
      {
        args: ["call", "engine", "julia", "close", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertStderrIncludes(close_output, "worker is busy");

    const status_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output);
    assertStdoutIncludes(status_output, "workers active: 1");

    const force_close_output = new Deno.Command(
      quartoCmd(),
      {
        args: ["call", "engine", "julia", "close", "--force", sleepQmd],
        cwd: juliaTestDir,
      },
    ).outputSync();
    assertSuccess(force_close_output);
    assertStderrIncludes(force_close_output, "Worker force-closed successfully");

    const status_output_2 = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "status"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(status_output_2);
    assertStdoutIncludes(status_output_2, "workers active: 0");

    const render_output = await render_cmd;
    assertStderrIncludes(render_output, "File was force-closed during run");
  });

  await t.step("log exists", () => {
    const log_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStdoutIncludes(log_output, "Log started at");
  });

  await t.step("stop the idling server", async () => {
    const stop_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "stop"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(stop_output);
    assertStderrIncludes(stop_output, "Server stopped");

    await delay(2000);

    const log_output = new Deno.Command(
      quartoCmd(),
      { args: ["call", "engine", "julia", "log"], cwd: juliaTestDir },
    ).outputSync();
    assertSuccess(log_output);
    assertStdoutIncludes(log_output, "Server stopped");
  });
});
