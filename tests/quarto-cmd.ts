/*
* quarto-cmd.ts
*
* Single dispatch point for invoking the quarto under test.
*
* By default (dev mode) quarto runs in-process by calling the `quarto()`
* entry point imported from ../src/quarto.ts, exactly as the harness always
* has. When QUARTO_TEST_BIN points at an installed quarto (a built
* distribution extracted OUTSIDE this checkout — the launcher enters dev
* mode when it finds a sibling src/quarto.ts), quarto is spawned as a
* subprocess instead, with `--log <file> --log-format json-stream` so the
* existing log-record verifiers keep working unchanged.
*
* See dev-docs/smoke-tests-built-version-plan.md for the full design.
*
* Copyright (C) 2020-2026 Posit Software, PBC
*
*/
import { quarto } from "../src/quarto.ts";
import { isWindows } from "../src/deno_ral/platform.ts";

// Env vars that identify the dev tree (or stale per-render state) and must
// never leak into the spawned binary: the installed launchers inherit
// QUARTO_SHARE_PATH / QUARTO_DEBUG / QUARTO_DENO / QUARTO_DENO_DOM when
// already set, and never reset DENO_DIR outside dev mode. Logging vars are
// stripped because the seam owns logging via explicit CLI flags. Everything
// else in the ambient environment (PATH, HOME, toolchain locations like
// QUARTO_PYTHON/QUARTO_R, platform system vars) is inherited; per-test env
// is overlaid last so tests can deliberately set any of these.
const kStripEnvVars = [
  "QUARTO_SHARE_PATH",
  "QUARTO_BIN_PATH",
  "QUARTO_DEBUG",
  "DENO_DIR",
  "QUARTO_DENO",
  "QUARTO_DENO_DOM",
  "QUARTO_ROOT",
  "QUARTO_SRC_PATH",
  "QUARTO_FORCE_VERSION",
  "QUARTO_VERSION_REQUIREMENT",
  "QUARTO_PROJECT_DIR",
  "QUARTO_PROFILE",
  "QUARTO_LOG",
  "QUARTO_LOG_LEVEL",
  "QUARTO_LOG_FORMAT",
  "RSTUDIO",
];

const kDevVersionSentinel = "99.9.9";

// json-stream ERROR record shape expected by readExecuteOutput/verify.ts
// (level 40 == std/log LogLevels.ERROR)
const kErrorLevel = 40;

export function binaryMode(): string | undefined {
  const bin = Deno.env.get("QUARTO_TEST_BIN");
  return bin && bin.length > 0 ? bin : undefined;
}

export function buildBinaryEnv(
  overlay?: Record<string, string>,
): Record<string, string> {
  const env = Deno.env.toObject();
  for (const name of kStripEnvVars) {
    delete env[name];
  }
  return { ...env, ...(overlay ?? {}) };
}

// Appends a synthetic ERROR record to a json-stream log file. Only call
// after the child process has exited (single-writer at that point).
export function appendLogError(logFile: string, msg: string) {
  const record = JSON.stringify({
    msg,
    level: kErrorLevel,
    levelName: "ERROR",
  });
  let existing = "";
  try {
    existing = Deno.readTextFileSync(logFile);
  } catch {
    // file may not exist yet
  }
  const sep = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
  Deno.writeTextFileSync(logFile, existing + sep + record + "\n");
}

function hasErrorRecord(logFile: string): boolean {
  let content = "";
  try {
    content = Deno.readTextFileSync(logFile);
  } catch {
    return false;
  }
  for (const line of content.split("\n")) {
    if (!line) continue;
    try {
      const record = JSON.parse(line);
      if (
        typeof record?.levelName === "string" &&
        record.levelName.toLowerCase() === "error"
      ) {
        return true;
      }
    } catch {
      // tolerate partial/corrupt lines
    }
  }
  return false;
}

// QUARTO_TEST_BIN must point at an installed layout, not the dev tree: the
// installed launcher enters dev mode (runs the TS sources) whenever a
// sibling src/quarto.ts exists, and reports the 99.9.9 dev sentinel. Fail
// loudly rather than silently testing the wrong thing.
let checkedBinary: string | undefined;
export function assertTestBinary(bin: string) {
  if (checkedBinary === bin) {
    return;
  }
  const result = new Deno.Command(bin, {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
  }).outputSync();
  const version = new TextDecoder().decode(result.stdout).trim();
  if (result.code !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) failed to report a version (exit ${result.code}):\n${stderr}`,
    );
  }
  if (version === kDevVersionSentinel) {
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) reports the dev version sentinel ${kDevVersionSentinel}. ` +
        `It is resolving to a dev-mode quarto (the launcher runs the TS sources when a ` +
        `sibling src/quarto.ts exists). Point QUARTO_TEST_BIN at a built distribution ` +
        `extracted outside the git checkout.`,
    );
  }
  const expected = Deno.env.get("QUARTO_TEST_EXPECTED_VERSION");
  if (expected && version !== expected) {
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) reports version ${version}, expected ${expected} ` +
        `(QUARTO_TEST_EXPECTED_VERSION).`,
    );
  }
  console.log(`[binary mode] testing quarto ${version} at ${bin}`);
  checkedBinary = bin;
}

// QUARTO_TEST_BIN is a launcher that spawns deno and waits (it does not
// exec), so killing the direct child would orphan the actual renderer —
// which also still holds the --log file at its own offset. Kill the whole
// tree, deepest first. (Best effort: children spawned between collection
// and kill can escape.)
async function killProcessTree(pid: number) {
  if (isWindows) {
    await new Deno.Command("taskkill", {
      args: ["/PID", String(pid), "/T", "/F"],
      stdout: "null",
      stderr: "null",
    }).output();
    return;
  }
  const pids: number[] = [];
  const stack = [pid];
  while (stack.length > 0) {
    const current = stack.pop()!;
    pids.push(current);
    try {
      const result = new Deno.Command("ps", {
        args: ["-o", "pid=", "--ppid", String(current)],
        stdout: "piped",
        stderr: "null",
      }).outputSync();
      const children = new TextDecoder()
        .decode(result.stdout)
        .split("\n")
        .map((line) => parseInt(line.trim(), 10))
        .filter((child) => !isNaN(child));
      stack.push(...children);
    } catch {
      // ps unavailable; fall back to killing what we have
    }
  }
  for (const target of pids.reverse()) {
    try {
      Deno.kill(target, "SIGKILL");
    } catch {
      // already exited
    }
  }
}

export interface RunQuartoOptions {
  // per-test environment overlay (TestContext.env)
  env?: Record<string, string>;
  // working directory for the spawned binary (binary mode only; dev mode
  // call sites manage cwd via Deno.chdir as they always have)
  cwd?: string;
  // json-stream log target; when set (binary mode), --log/--log-format/
  // --log-level flags are appended so verifiers can read the records
  logFile?: string;
  logLevel?: string;
  logFormat?: string;
  timeoutMs?: number;
  // Binary mode only: throw when the child exits non-zero or times out.
  // Defaults to TRUE so direct call sites (module-level project
  // pre-renders, context.setup pre-renders) keep today's fail-loudly
  // semantics. testQuartoCmd passes false and relies on the log records
  // (including the synthetic one below) reaching the verifiers.
  // In dev mode failures always propagate as exceptions, exactly as today.
  throwOnFailure?: boolean;
}

export interface RunQuartoResult {
  code: number;
  timedOut: boolean;
  stderrTail?: string;
}

export async function runQuarto(
  args: string[],
  options: RunQuartoOptions = {},
): Promise<RunQuartoResult> {
  const bin = binaryMode();
  const timeoutMs = options.timeoutMs ?? 600000;

  if (!bin) {
    // dev mode: in-process call, preserving existing semantics exactly
    // (a timeout rejects but does not kill the in-process render)
    const timeout = new Promise<never>((_resolve, reject) => {
      setTimeout(reject, timeoutMs, `timed out after ${timeoutMs}ms`);
    });
    await Promise.race([quarto(args, undefined, options.env), timeout]);
    return { code: 0, timedOut: false };
  }

  assertTestBinary(bin);
  const throwOnFailure = options.throwOnFailure ?? true;

  const spawnArgs = [...args];
  if (options.logFile) {
    spawnArgs.push(
      "--log",
      options.logFile,
      "--log-format",
      options.logFormat ?? "json-stream",
      // per-test log intent must land in the flags: explicit flags beat
      // QUARTO_LOG_LEVEL env in quarto's logOptions, so passing the env
      // var through would be silently ignored
      "--log-level",
      options.logLevel ?? options.env?.QUARTO_LOG_LEVEL ?? "info",
    );
  }

  const child = new Deno.Command(bin, {
    args: spawnArgs,
    cwd: options.cwd ?? Deno.cwd(),
    env: buildBinaryEnv(options.env),
    clearEnv: true,
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    killProcessTree(child.pid);
  }, timeoutMs);

  // output() drains both streams (undrained pipes deadlock at the 64KiB
  // buffer on verbose renders) and resolves once the process exits —
  // including after a kill
  const output = await child.output();
  clearTimeout(timer);

  const stderrText = new TextDecoder().decode(output.stderr);
  const stderrTail = stderrText.split("\n").slice(-25).join("\n").trim();
  const commandLine = `quarto ${args.join(" ")}`;

  if (options.logFile) {
    if (timedOut) {
      appendLogError(
        options.logFile,
        `${commandLine} timed out after ${timeoutMs}ms and was killed`,
      );
    } else if (output.code !== 0 && !hasErrorRecord(options.logFile)) {
      // A child can exit non-zero without any ERROR record: failures
      // before logger init (deno startup, bundle load, missing share) and
      // commandFailed paths (quarto add/remove). Without this synthetic
      // record, log-only verifiers (noErrorsOrWarnings — the default
      // smoke-all spec) would pass vacuously against an empty log.
      appendLogError(
        options.logFile,
        `${commandLine} exited with code ${output.code} without logging an error\n` +
          `stderr (tail):\n${stderrTail}`,
      );
    }
  }

  if ((output.code !== 0 || timedOut) && throwOnFailure) {
    throw new Error(
      timedOut
        ? `${commandLine} timed out after ${timeoutMs}ms`
        : `${commandLine} exited with code ${output.code}\nstderr (tail):\n${stderrTail}`,
    );
  }

  return { code: output.code, timedOut, stderrTail };
}
