/*
 * quarto-cmd.ts
 *
 * Single dispatch point for invoking the quarto under test.
 *
 * Runs the dev sources in-process or QUARTO_TEST_BIN as a subprocess.
 * See llm-docs/built-version-testing-architecture.md.
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
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

export function quartoTestBin(): string | undefined {
  const bin = Deno.env.get("QUARTO_TEST_BIN");
  return bin && bin.length > 0 ? bin : undefined;
}

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

// Result of attempting to stop a process tree. `cancelled` is true only when
// tree enumeration and termination are confirmed. Enumeration, command, or
// kill errors leave it false so callers do not continue while descendants
// may still be running.
interface KillOutcome {
  cancelled: boolean;
  detail: string;
}

// The launcher waits on Deno, so kill the process tree deepest first.
async function killProcessTree(pid: number): Promise<KillOutcome> {
  if (isWindows) {
    try {
      // `Deno.Command.output()` returns non-zero exit codes without throwing.
      // Only a spawn failure throws, so check the exit code explicitly.
      const result = await new Deno.Command("taskkill", {
        args: ["/PID", String(pid), "/T", "/F"],
        stdout: "null",
        stderr: "piped",
      }).output();
      if (result.code === 0) {
        return {
          cancelled: true,
          detail: `taskkill /T /F pid ${pid} exited 0`,
        };
      }
      // taskkill did not confirm the tree. Still attempt to unblock
      // child.output() by killing the launcher directly, but this reaches
      // only the launcher, not its descendants, so the outcome stays
      // unconfirmed regardless of whether this fallback succeeds.
      try {
        Deno.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
      const stderrText = new TextDecoder().decode(result.stderr).trim();
      return {
        cancelled: false,
        detail: `taskkill /T /F pid ${pid} exited ${result.code}: ${stderrText}`,
      };
    } catch (e) {
      try {
        Deno.kill(pid, "SIGKILL");
      } catch {
        // already exited
      }
      return {
        cancelled: false,
        detail: `taskkill /T /F pid ${pid} failed to spawn: ${String(e)}`,
      };
    }
  }

  // On Unix, enumerate descendants with pgrep -P. Exit 0 must have parseable
  // output, while exit 1 means no children. Any other result leaves
  // cancellation unconfirmed, but all collected pids are still signalled.
  //
  // This confirms only descendants found during the pgrep walk. A process
  // spawned or reparented before termination may not be included. Avoiding
  // this race would require process-group support.
  const pids: number[] = [];
  const stack = [pid];
  let confirmed = true;
  let unconfirmedDetail = "";
  while (stack.length > 0) {
    const current = stack.pop()!;
    pids.push(current);

    let spawnFailed = false;
    let code = -1;
    let stdoutText = "";
    let stderrText = "";
    try {
      const result = new Deno.Command("pgrep", {
        args: ["-P", String(current)],
        stdout: "piped",
        stderr: "piped",
      }).outputSync();
      code = result.code;
      stdoutText = new TextDecoder().decode(result.stdout);
      stderrText = new TextDecoder().decode(result.stderr);
    } catch (e) {
      spawnFailed = true;
      stderrText = String(e);
    }

    if (spawnFailed) {
      confirmed = false;
      unconfirmedDetail = `pgrep -P ${current} failed to spawn: ${stderrText}`;
      continue;
    }
    if (code === 1) {
      // No children matched: a genuine leaf, nothing to push.
      continue;
    }
    if (code !== 0) {
      // Usage (2) or internal (3) error: enumeration unreliable.
      confirmed = false;
      unconfirmedDetail = `pgrep -P ${current} exited ${code}: ${stderrText.trim()}`;
      continue;
    }
    const lines = stdoutText.split("\n").map((line) => line.trim()).filter((
      line,
    ) => line.length > 0);
    const children = lines.map((line) => parseInt(line, 10));
    if (children.some((child) => isNaN(child))) {
      confirmed = false;
      unconfirmedDetail =
        `pgrep -P ${current} produced unparseable output: ${stdoutText.trim()}`;
    }
    stack.push(...children.filter((child) => !isNaN(child)));
  }

  let signalled = 0;
  for (const target of pids.reverse()) {
    try {
      Deno.kill(target, "SIGKILL");
      signalled++;
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) {
        confirmed = false;
        unconfirmedDetail = `kill pid ${target} failed: ${String(e)}`;
      }
    }
  }
  return {
    cancelled: confirmed,
    detail: confirmed
      ? `signalled ${signalled} pid(s) from root ${pid}`
      : (unconfirmedDetail || `could not confirm process tree from root ${pid}`),
  };
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

// A render timeout, discriminated from a plain failure so a caller can tell
// whether the render is known to have been stopped.
export class QuartoTimeoutError extends Error {
  constructor(
    message: string,
    readonly timeoutMs: number,
    // True only when the render is known to have been stopped. Dev mode
    // races a timer against an in-process render it cannot cancel, so it is
    // always false there; binary mode sets it from the process-tree kill
    // outcome.
    readonly renderCancelled: boolean,
    // Platform detail of the kill attempt, including the child pid.
    // Undefined in dev mode, which attempts no kill.
    readonly killDetail?: string,
  ) {
    super(message);
    this.name = "QuartoTimeoutError";
  }
}

export function isQuartoTimeoutError(e: unknown): e is QuartoTimeoutError {
  return e instanceof QuartoTimeoutError;
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
    timer = setTimeout(
      reject,
      timeoutMs,
      new QuartoTimeoutError(
        `timed out after ${timeoutMs}ms`,
        timeoutMs,
        // Dev mode cannot stop an in-process render. A timeout rejects the
        // caller, but the render continues.
        false,
      ),
    );
  });
  try {
    await Promise.race([quarto(args, undefined, options.env), timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
  // quarto() calls exitWithCleanup(1), which Deno.exits the whole test
  // process, only for a CommandError (Cliffy argument parsing) or
  // commandFailed() (set only by the add/remove commands, never render).
  // A render failure is neither, so it rejects out of quarto() instead.
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
  let killPromise: Promise<KillOutcome> | undefined;
  const timer = setTimeout(() => {
    timedOut = true;
    killPromise = killProcessTree(child.pid);
  }, timeoutMs);

  // Drain both streams to avoid pipe-buffer deadlocks.
  const output = await child.output();
  clearTimeout(timer);

  // The direct child is known dead at this point (child.output() above
  // already resolved), but the deno/pandoc descendants it spawned are only
  // known dead if killOutcome.cancelled is true.
  let killOutcome: KillOutcome = {
    cancelled: false,
    detail: "no timeout occurred",
  };
  if (timedOut && killPromise !== undefined) {
    try {
      killOutcome = await killPromise;
    } catch (e) {
      killOutcome = {
        cancelled: false,
        detail: `killProcessTree rejected: ${String(e)}`,
      };
    }
  }

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

  // Warn non-throwing callers when cancellation is unconfirmed. Throwing
  // callers receive the same detail in QuartoTimeoutError below.
  if (timedOut && !killOutcome.cancelled && !throwOnFailure) {
    console.error(
      `[binary mode] process-tree kill UNCONFIRMED: ${commandLine} ` +
        `(pid ${child.pid}) timed out after ${timeoutMs}ms; ${killOutcome.detail}. ` +
        `Descendant quarto/pandoc processes may still be running and writing, ` +
        `and the caller is continuing anyway, so later failures in this run ` +
        `may be corruption from the orphan rather than genuine.`,
    );
  }

  if ((output.code !== 0 || timedOut) && throwOnFailure) {
    if (timedOut) {
      const base =
        `${commandLine} (pid ${child.pid}) timed out after ${timeoutMs}ms`;
      const message = killOutcome.cancelled
        ? base
        : `${base}; process-tree kill UNCONFIRMED: ${killOutcome.detail}`;
      throw new QuartoTimeoutError(
        message,
        timeoutMs,
        killOutcome.cancelled,
        killOutcome.detail,
      );
    }
    throw new Error(
      `${commandLine} exited with code ${output.code}\nstderr (tail):\n${stderrTail}`,
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
