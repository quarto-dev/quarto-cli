/*
 * process.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process-shaped runtime APIs, implemented on Deno.
 * tests/unit/ral/process.test.ts is the contract every implementation keeps.
 */

import { isWindows } from "./platform.ts";

export type StdioOption = "piped" | "inherit" | "null";
export type Signal = "SIGTERM" | "SIGKILL" | "SIGINT";

export interface SpawnOptions {
  args?: string[];
  cwd?: string;
  /** Merged over the inherited environment, unless clearEnv is true. */
  env?: Record<string, string>;
  /** Start from an empty environment (only `env` is passed). */
  clearEnv?: boolean;
  stdin?: StdioOption;
  stdout?: StdioOption;
  stderr?: StdioOption;
  signal?: AbortSignal;
  /** POSIX: the child leads a new process group (setsid/setpgid), so killProcess(-pid)
   *  reaches its descendants. Windows: the runtime's detached semantics
   *  (Node: DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP); Quarto passes it on
   *  POSIX only. */
  detached?: boolean;
}

export interface ExitStatus {
  success: boolean;
  code: number;
  signal: string | null;
}

export interface ExecOutput extends ExitStatus {
  stdout: Uint8Array;
  stderr: Uint8Array;
}

export interface ChildProcess {
  readonly pid: number;
  readonly stdin: WritableStream<Uint8Array> | null;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly status: Promise<ExitStatus>;
  kill(signal?: Signal): void;
}

function toStatus(s: Deno.CommandStatus): ExitStatus {
  return { success: s.success, code: s.code, signal: s.signal ?? null };
}

function commandOptions(
  options: SpawnOptions,
  defaults: { stdin: StdioOption; stdout: StdioOption; stderr: StdioOption },
): Deno.CommandOptions {
  // Deno.Command merges `env` over the inherited environment unless clearEnv.
  return {
    args: options.args,
    cwd: options.cwd,
    env: options.env,
    clearEnv: options.clearEnv,
    signal: options.signal,
    detached: options.detached,
    stdin: options.stdin ?? defaults.stdin,
    stdout: options.stdout ?? defaults.stdout,
    stderr: options.stderr ?? defaults.stderr,
  };
}

const kSpawnDefaults = {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
} as const;
const kExecDefaults = {
  stdin: "null",
  stdout: "piped",
  stderr: "piped",
} as const;

/**
 * Start a child process. stdin/stdout/stderr default to "inherit". A missing
 * executable throws synchronously on Deno.
 */
export function spawn(cmd: string, options: SpawnOptions = {}): ChildProcess {
  const opts = commandOptions(options, kSpawnDefaults);
  const child = new Deno.Command(cmd, opts).spawn();
  return {
    pid: child.pid,
    stdin: opts.stdin === "piped" ? child.stdin : null,
    stdout: opts.stdout === "piped" ? child.stdout : null,
    stderr: opts.stderr === "piped" ? child.stderr : null,
    status: child.status.then(toStatus),
    kill(signal: Signal = "SIGTERM") {
      child.kill(signal);
    },
  };
}

function toExecOutput(
  output: Deno.CommandOutput,
  opts: Deno.CommandOptions,
): ExecOutput {
  return {
    ...toStatus(output),
    stdout: opts.stdout === "piped" ? output.stdout : new Uint8Array(),
    stderr: opts.stderr === "piped" ? output.stderr : new Uint8Array(),
  };
}

// The wrapper keeps the runtime error as `cause` and a Node-style `code`, so
// that deno_ral/errors.ts predicates (isNotFound) recognise it.
function execError(cmd: string, e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  const err = new Error(`Error executing '${cmd}': ${msg}`, { cause: e });
  const code = e instanceof Deno.errors.NotFound
    ? "ENOENT"
    : (typeof e === "object" && e !== null && "code" in e &&
        typeof (e as { code: unknown }).code === "string")
    ? (e as { code: string }).code
    : undefined;
  if (code !== undefined) {
    (err as Error & { code?: string }).code = code;
  }
  return err;
}

/**
 * Run a command to completion. stdin defaults to "null", stdout and stderr to
 * "piped". Rejects when the executable cannot be started.
 */
export async function exec(
  cmd: string,
  options: SpawnOptions = {},
): Promise<ExecOutput> {
  if (options.stdin === "piped") {
    throw new TypeError("exec() cannot pipe stdin; use spawn()");
  }
  const opts = commandOptions(options, kExecDefaults);
  try {
    const output = await new Deno.Command(cmd, opts).output();
    return toExecOutput(output, opts);
  } catch (e) {
    throw execError(cmd, e);
  }
}

/** Synchronous exec with the same defaults and errors. */
export function execSync(cmd: string, options: SpawnOptions = {}): ExecOutput {
  if (options.stdin === "piped") {
    throw new TypeError("execSync() cannot pipe stdin; use spawn()");
  }
  const opts = commandOptions(options, kExecDefaults);
  try {
    const output = new Deno.Command(cmd, opts).outputSync();
    return toExecOutput(output, opts);
  } catch (e) {
    throw execError(cmd, e);
  }
}

/**
 * Exit; nothing written before the call is lost. Deno's standard-stream writes
 * are synchronous, so nothing is pending here.
 */
export function exit(code?: number): never {
  return Deno.exit(code);
}

export function cwd(): string {
  return Deno.cwd();
}

export function chdir(dir: string): void {
  Deno.chdir(dir);
}

export function args(): string[] {
  return [...Deno.args];
}

export function execPath(): string {
  return Deno.execPath();
}

export function pid(): number {
  return Deno.pid;
}

/**
 * Install a signal handler. SIGTERM is a no-op on Windows, where it is never
 * delivered; SIGINT works everywhere (Deno maps console interruption to it).
 */
export function onSignal(
  signal: "SIGINT" | "SIGTERM",
  handler: () => void,
): void {
  if (signal === "SIGTERM" && isWindows) {
    return;
  }
  Deno.addSignalListener(signal, handler);
}

/**
 * Send a signal to a process. A negative pid addresses the process group led
 * by -pid (POSIX; spawn the leader with `detached: true`) or, on Windows, the
 * process tree rooted at -pid (taskkill /T; the signal is ignored).
 */
export function killProcess(pid: number, signal: Signal = "SIGTERM"): void {
  if (isWindows && pid < 0) {
    // No process groups to signal: end the tree rooted at -pid. taskkill
    // exits 128 when the pid does not exist.
    const r = new Deno.Command("taskkill", {
      args: ["/PID", String(-pid), "/T", "/F"],
      stdout: "null",
      stderr: "null",
    }).outputSync();
    if (r.code === 128) {
      throw Object.assign(new Error(`taskkill: no process ${-pid}`), {
        code: "ESRCH",
      });
    }
    if (!r.success) {
      throw new Error(`taskkill /PID ${-pid} /T /F exited with code ${r.code}`);
    }
    return;
  }
  Deno.kill(pid, signal);
}

// Loop over partial writes. A 0-byte write stops the loop (never spin, never
// throw: core/log.ts relied on that), and a broken pipe means the reader went
// away (`quarto inspect | head -c 1`), so the rest is dropped.
function writeAllSync(
  stream: { writeSync(p: Uint8Array): number },
  data: Uint8Array,
): number {
  let written = 0;
  while (written < data.length) {
    let n: number;
    try {
      n = stream.writeSync(data.subarray(written));
    } catch (e) {
      if (e instanceof Deno.errors.BrokenPipe) {
        return written;
      }
      throw e;
    }
    if (n === 0) {
      break;
    }
    written += n;
  }
  return written;
}

export function writeStdoutSync(data: Uint8Array): number {
  return writeAllSync(Deno.stdout, data);
}

export function writeStderrSync(data: Uint8Array): number {
  return writeAllSync(Deno.stderr, data);
}

export function isTerminal(stream: "stdin" | "stdout" | "stderr"): boolean {
  return Deno[stream].isTerminal();
}

/** Read standard input until EOF. */
export async function readStdin(): Promise<Uint8Array> {
  return await new Response(Deno.stdin.readable).bytes();
}

/**
 * Standard input as lines (without the line terminator). Stopping early
 * (break/return in for-await) closes stdin: Deno's stdin stream does not
 * close its resource on cancel, and a pending read would keep the process
 * alive (create --json used to call Deno.stdin.close() for this reason).
 */
export async function* readStdinLines(): AsyncIterable<string> {
  const decoder = new TextDecoder();
  let pending = "";
  let reachedEof = false;
  try {
    for await (const chunk of Deno.stdin.readable) {
      pending += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf("\n")) >= 0) {
        yield pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
      }
    }
    reachedEof = true;
    pending += decoder.decode();
    if (pending.length > 0) {
      yield pending.replace(/\r$/, "");
    }
  } finally {
    if (!reachedEof) {
      try {
        Deno.stdin.close();
      } catch {
        // already closed
      }
    }
  }
}

/** Deprecated alias of exec, kept for its existing callers. */
export const call = (cmd: string, options: SpawnOptions = {}) =>
  exec(cmd, options);
