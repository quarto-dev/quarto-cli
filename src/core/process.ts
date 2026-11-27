/*
 * process.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { MuxAsyncIterator } from "async";
import { debug, info } from "../deno_ral/log.ts";
import {
  type ChildProcess,
  spawn,
  type SpawnOptions,
  type StdioOption,
  writeStderrSync,
  writeStdoutSync,
} from "../deno_ral/process.ts";
import { onCleanup } from "./cleanup.ts";
import { ProcessResult } from "./process-types.ts";

const processList = new Map<number, ChildProcess>();
let processCount = 0;
let cleanupRegistered = false;

export function registerForExitCleanup(process: ChildProcess) {
  // The registry is only killed by a handler that execProcess used to be the
  // sole installer of, so registering a process was not on its own enough to
  // have it cleaned up. Install it here too: a command that spawns a browser
  // and never shells out (`quarto call axe`) must still not orphan it on
  // Ctrl-C.
  ensureCleanup();
  const thisProcessId = ++processCount; // don't risk repeated PIDs
  processList.set(thisProcessId, process);
  return thisProcessId;
}

export function unregisterForExitCleanup(processId: number) {
  processList.delete(processId);
}

function ensureCleanup() {
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    onCleanup(() => {
      for (const process of processList.values()) {
        try {
          process.kill();
        } catch (error) {
          info("Error occurred during cleanup: " + error);
        }
      }
    });
  }
}

export type ExecProcessOptions = SpawnOptions & {
  cmd: string;
};

export async function execProcess(
  options: ExecProcessOptions,
  stdin?: string,
  mergeOutput?: "stderr>stdout" | "stdout>stderr",
  stderrFilter?: (output: string) => string,
  respectStreams?: boolean,
  timeout?: number,
): Promise<ProcessResult> {
  const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
    return timeout
      ? Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Process timed out")), timeout)
        ),
      ]) as Promise<T>
      : promise;
  };
  ensureCleanup();
  // define process
  try {
    debug(`[execProcess] ${[options.cmd, ...(options.args || [])].join(" ")}`);
    // stdout/stderr are always piped here; "inherit" is implemented below by
    // processOutput so that output can be captured and echoed at once.
    const process = spawn(options.cmd, {
      args: options.args,
      cwd: options.cwd,
      env: options.env,
      clearEnv: options.clearEnv,
      detached: options.detached,
      signal: options.signal,
      stdin: stdin !== undefined ? "piped" : (options.stdin ?? "inherit"),
      stdout: "piped",
      stderr: "piped",
    });
    const thisProcessId = registerForExitCleanup(process);

    if (stdin !== undefined) {
      if (!process.stdin) {
        unregisterForExitCleanup(thisProcessId);
        throw new Error("Process stdin not available");
      }
      const stdinWriter = process.stdin.getWriter();
      // write in 4k chunks (deno observed to overflow at > 64k)
      const kWindowSize = 4096;
      const buffer = new TextEncoder().encode(stdin);
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + kWindowSize, buffer.length);
        const window = buffer.subarray(offset, end);
        await stdinWriter.write(window);
        offset += window.byteLength;
      }
      stdinWriter.releaseLock();
      try {
        await process.stdin.close();
      } catch (e) {
        // The child may have closed its read end of the pipe before our
        // close() completed (e.g. exited fast, failed to spawn). The
        // resulting "Writable stream is closed or errored." is not a
        // failure of execProcess — the child's exit status reflects any
        // real problem. Swallow it so it doesn't escape as an unhandled
        // rejection that aborts the process. See #14445.
        debug(`[execProcess] stdin.close() rejected: ${e}`);
      }
    }

    let stdoutText = "";
    let stderrText = "";

    // If the caller requests, merge the output into a single stream. This single stream will
    // follow the runoption for that stream (e.g. inherit, pipe, etc...)
    if (mergeOutput) {
      // This multiplexer that holds the async streams and merges their results
      const multiplexIterator = new MuxAsyncIterator<
        Uint8Array
      >();

      // Add streams to the multiplexer
      const addStream = (
        iterator: AsyncIterableIterator<Uint8Array>,
        filter?: (output: string) => string,
      ) => {
        multiplexIterator.add(filteredAsyncIterator(iterator, filter));
      };

      addStream(process.stdout!.values());
      addStream(process.stderr!.values(), stderrFilter);

      // Process the output
      const allOutput = await processOutput(
        multiplexIterator,
        mergeOutput === "stderr>stdout" ? options.stdout : options.stderr,
      );

      // Provide the output in whichever result the user requested
      if (mergeOutput === "stderr>stdout") {
        stdoutText = allOutput;
      } else {
        stderrText = allOutput;
      }
    } else {
      // Process the streams independently
      const promises: Promise<void>[] = [];
      let signalReaderGone!: () => void;
      const readerGoneSignal = new Promise<void>((r) => signalReaderGone = r);
      const readerGone: ReaderGone = {
        gone: false,
        stop: () => {
          readerGone.gone = true;
          try {
            process.kill();
          } catch {
            // already exited
          }
          signalReaderGone();
        },
      };

      if (process.stdout !== null) {
        promises.push(
          processOutput(
            process.stdout.values(),
            options.stdout,
            respectStreams ? "stdout" : undefined,
            readerGone,
          ).then((text) => {
            stdoutText = text;
          }),
        );
      }

      if (process.stderr != null) {
        const iterator = stderrFilter
          ? filteredAsyncIterator(process.stderr.values(), stderrFilter)
          : process.stderr.values();
        promises.push(
          processOutput(
            iterator,
            options.stderr,
            respectStreams ? "stderr" : undefined,
            readerGone,
          ).then((text) => {
            stderrText = text;
          }),
        );
      }
      // Once our reader is gone, a worker the child started can still hold
      // its pipes open: wait for the child's exit, not for the pipes' EOF.
      await withTimeout(Promise.race([Promise.all(promises), readerGoneSignal]));
    }

    // await result
    const status = await withTimeout(process.status);

    unregisterForExitCleanup(thisProcessId);

    debug(`[execProcess] Success: ${status.success}, code: ${status.code}`);

    return {
      success: status.success,
      code: status.code,
      stdout: stdoutText,
      stderr: stderrText,
    };
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }
    throw new Error(`Error executing '${options.cmd}': ${e.message}`);
  }
}

export function processSuccessResult(): ProcessResult {
  return {
    success: true,
    code: 0,
  };
}

// Re-encodes a byte stream so each yielded chunk holds whole characters: a
// multi-byte character split across two reads is held back until complete.
// Chunks that decode to no text yet are skipped, so the filter never sees "".
async function* filteredAsyncIterator(
  iterator: AsyncIterable<Uint8Array>,
  filter?: (output: string) => string,
): AsyncGenerator<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const encode = (text: string) =>
    encoder.encode(filter ? filter(text) : text);
  for await (const chunk of iterator) {
    const text = decoder.decode(chunk, { stream: true });
    if (text !== "") {
      yield encode(text);
    }
  }
  const tail = decoder.decode();
  if (tail !== "") {
    yield encode(tail);
  }
}

// Shared by both streams of one child: once a passthrough write is short, the
// child is stopped, and the rest of both pipes (a worker it started may keep
// writing) is drained without being kept.
type ReaderGone = { gone: boolean; stop: () => void };

// Processes ouptut from an interator (stderr, stdout, etc...)
// With `which`, a short write means the reader of our own stream went away
// (`quarto run script | head`): readerGone.stop() stops the child, so its
// output ends instead of accumulating.
async function processOutput(
  iterator: AsyncIterable<Uint8Array>,
  output?: StdioOption,
  which?: "stdout" | "stderr",
  readerGone?: ReaderGone,
): Promise<string> {
  const decoder = new TextDecoder();
  let outputText = "";
  const accept = (text: string) => {
    if (text === "") {
      return;
    }
    if ((output === "inherit" || output === undefined) && !which) {
      info(text, { newline: false });
    }
    outputText += text;
  };
  const write = which === "stdout"
    ? writeStdoutSync
    : which === "stderr"
    ? writeStderrSync
    : undefined;
  for await (const chunk of iterator) {
    if (readerGone?.gone) {
      continue;
    }
    if (
      write && (output === "inherit" || output === undefined) &&
      write(chunk) < chunk.length
    ) {
      readerGone?.stop();
      continue;
    }
    accept(decoder.decode(chunk, { stream: true }));
  }
  accept(decoder.decode());
  return outputText;
}
