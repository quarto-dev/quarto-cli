/*
* quarto-cmd.ts
*
* Single dispatch point for invoking the quarto under test.
*
* Runs the dev sources in-process or QUARTO_TEST_BIN as a subprocess.
* See llm-docs/built-version-testing-architecture.md.
*
* Copyright (C) 2020-2026 Posit Software, PBC
*
*/
import { quarto } from "../src/quarto.ts";
import { kLocalDevelopment } from "../src/core/quarto.ts";
import { isWindows } from "../src/deno_ral/platform.ts";
import { join } from "../src/deno_ral/path.ts";

// Strip dev-tree and logging state from built-binary spawns. Other ambient
// variables are inherited, then the per-test environment is applied.
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

// std/log LogLevels.ERROR, as expected by readExecuteOutput().
const kErrorLevel = 40;

// Default per-invocation render timeout (dev and binary mode alike).
const kDefaultRenderTimeoutMs = 600000;

// Path of the built quarto under test, when binary mode is active.
export function quartoTestBin(): string | undefined {
  const bin = Deno.env.get("QUARTO_TEST_BIN");
  return bin && bin.length > 0 ? bin : undefined;
}

// True when tests target an external built Quarto.
export function isBinaryMode(): boolean {
  return quartoTestBin() !== undefined;
}

// Use QUARTO_TEST_BIN in binary mode; otherwise pin the local dev CLI.
export function quartoDevBinCmd(): string {
  const bin = quartoTestBin();
  if (bin) {
    return bin;
  }
  const binPath = Deno.env.get("QUARTO_BIN_PATH") ??
    join("..", "package", "dist", "bin");
  return join(binPath, isWindows ? "quarto.cmd" : "quarto");
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

// Sanitize direct subprocess spawns in binary mode. Dev-mode spawns inherit
// the ambient environment and apply only the requested overlay.
export function quartoSpawnEnvOptions(
  overlay?: Record<string, string>,
): { env?: Record<string, string>; clearEnv?: boolean } {
  if (isBinaryMode()) {
    return { env: buildBinaryEnv(overlay), clearEnv: true };
  }
  return overlay !== undefined ? { env: overlay } : {};
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

// A timeout can interrupt a log write. Remove only the torn trailing record
// so readExecuteOutput() can remain strict.
function stripTornTrailingLine(content: string): string {
  const lines = content.split("\n");
  let i = lines.length - 1;
  while (i >= 0 && lines[i] === "") {
    i--;
  }
  if (i < 0) {
    return content;
  }
  try {
    JSON.parse(lines[i]);
    return content;
  } catch {
    lines.splice(i, 1);
    return lines.join("\n");
  }
}

function hasErrorRecordText(content: string): boolean {
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

// Reject an in-checkout launcher, which reports the 99.9.9 dev sentinel.
let checkedBinary: string | undefined;
export function assertTestBinary(bin: string) {
  if (checkedBinary === bin) {
    return;
  }
  // Probe with the same sanitized environment used by test spawns.
  const result = new Deno.Command(bin, {
    args: ["--version"],
    stdout: "piped",
    stderr: "piped",
    env: buildBinaryEnv(),
    clearEnv: true,
  }).outputSync();
  const version = new TextDecoder().decode(result.stdout).trim();
  if (result.code !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) failed to report a version (exit ${result.code}):\n${stderr}`,
    );
  }
  if (version.length === 0) {
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) reported an empty version. ` +
        `The distribution is likely incomplete (missing share/version).`,
    );
  }
  if (version === kLocalDevelopment) {
    throw new Error(
      `QUARTO_TEST_BIN (${bin}) reports the dev version sentinel ${kLocalDevelopment}. ` +
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

// The launcher waits on Deno, so kill the process tree deepest first.
async function killProcessTree(pid: number) {
  if (isWindows) {
    let killed = false;
    try {
      // taskkill reports failure through its exit code.
      const result = await new Deno.Command("taskkill", {
        args: ["/PID", String(pid), "/T", "/F"],
        stdout: "null",
        stderr: "null",
      }).output();
      killed = result.code === 0;
    } catch {
      // Fall through to a direct kill.
    }
    if (!killed) {
      // Ensure child.output() can resolve even if the tree kill failed.
      try {
        Deno.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
    }
    return;
  }
  const pids: number[] = [];
  const stack = [pid];
  while (stack.length > 0) {
    const current = stack.pop()!;
    pids.push(current);
    try {
      // pgrep -P works on Linux and macOS/BSD.
      const result = new Deno.Command("pgrep", {
        args: ["-P", String(current)],
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
      // pgrep unavailable; fall back to killing what we have
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
  // Per-test environment overlay.
  env?: Record<string, string>;
  // Binary-mode working directory.
  cwd?: string;
  // Binary-mode log target and options.
  logFile?: string;
  logLevel?: string;
  logFormat?: string;
  timeoutMs?: number;
  // Binary mode only. Defaults to true; testQuartoCmd disables it so
  // verifiers receive failures through log records.
  throwOnFailure?: boolean;
}

export interface RunQuartoResult {
  // Present only for binary-mode spawns. Dev mode has no exit code - it
  // reports failure by rejecting instead (see runDevQuarto).
  code?: number;
  timedOut: boolean;
  stderrTail?: string;
}

// Dispatch to the in-process dev sources or the configured built binary.
export async function runQuarto(
  args: string[],
  options: RunQuartoOptions = {},
): Promise<RunQuartoResult> {
  const bin = quartoTestBin();
  return bin
    ? runBinaryQuarto(bin, args, options)
    : runDevQuarto(args, options);
}

// A dev-mode timeout rejects but cannot stop the in-process render.
async function runDevQuarto(
  args: string[],
  options: RunQuartoOptions,
): Promise<RunQuartoResult> {
  const timeoutMs = options.timeoutMs ?? kDefaultRenderTimeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(reject, timeoutMs, `timed out after ${timeoutMs}ms`);
  });
  try {
    await Promise.race([quarto(args, undefined, options.env), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
  // quarto() either resolves or rejects: on CommandError or commandFailed()
  // it calls exitWithCleanup(1), which Deno.exits the whole test process
  // before this function could return a failure code anyway.
  return { timedOut: false };
}

// Spawn the built binary and enforce timeout, logging, and failure policy.
async function runBinaryQuarto(
  bin: string,
  args: string[],
  options: RunQuartoOptions,
): Promise<RunQuartoResult> {
  assertTestBinary(bin);
  const timeoutMs = options.timeoutMs ?? kDefaultRenderTimeoutMs;
  const throwOnFailure = options.throwOnFailure ?? true;

  // LogFileHandler truncates its target, so each child writes a temporary
  // log that is merged into the test log after exit.
  const spawnArgs = [...args];
  let childLog: string | undefined;
  if (options.logFile) {
    childLog = Deno.makeTempFileSync({ suffix: ".json" });
    spawnArgs.push(
      "--log",
      childLog,
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
    // child.output() resolves after the kill; avoid an unhandled rejection.
    killProcessTree(child.pid).catch(() => {});
  }, timeoutMs);

  // Drain both streams to avoid pipe-buffer deadlocks.
  const output = await child.output();
  clearTimeout(timer);

  const stderrText = new TextDecoder().decode(output.stderr);
  const stderrTail = stderrText.split("\n").slice(-25).join("\n").trim();
  const commandLine = `quarto ${args.join(" ")}`;

  if (options.logFile && childLog) {
    mergeChildLog(options.logFile, childLog, {
      timedOut,
      code: output.code,
      timeoutMs,
      commandLine,
      stderrTail,
    });
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

// Merge the child log and synthesize an ERROR when a failed child logged none.
function mergeChildLog(
  logFile: string,
  childLog: string,
  outcome: {
    timedOut: boolean;
    code: number;
    timeoutMs: number;
    commandLine: string;
    stderrTail: string;
  },
) {
  let childContent = "";
  try {
    childContent = Deno.readTextFileSync(childLog);
  } catch {
    // child never wrote the log (e.g. failed before logger init)
  }
  try {
    Deno.removeSync(childLog);
  } catch {
    // best effort
  }
  // Only a timeout kill can tear a line; a clean exit flushes whole records.
  if (outcome.timedOut) {
    childContent = stripTornTrailingLine(childContent);
  }
  // A quiet successful command still needs an empty log for its verifiers.
  let existing = "";
  try {
    existing = Deno.readTextFileSync(logFile);
  } catch {
    // log file may not exist yet
  }
  if (childContent.length > 0) {
    const sep = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
    Deno.writeTextFileSync(logFile, existing + sep + childContent);
  } else if (existing.length === 0) {
    Deno.writeTextFileSync(logFile, "");
  }
  if (outcome.timedOut) {
    appendLogError(
      logFile,
      `${outcome.commandLine} timed out after ${outcome.timeoutMs}ms and was killed`,
    );
  } else if (outcome.code !== 0 && !hasErrorRecordText(childContent)) {
    // Startup and commandFailed paths can exit without logging an error.
    appendLogError(
      logFile,
      `${outcome.commandLine} exited with code ${outcome.code} without logging an error\n` +
        `stderr (tail):\n${outcome.stderrTail}`,
    );
  }
}
