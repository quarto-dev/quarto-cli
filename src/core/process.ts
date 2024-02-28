/*
 * process.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { MuxAsyncIterator, pooledMap } from "async/mod.ts";
import { iterateReader } from "streams/mod.ts";
import { debug, info } from "../deno_ral/log.ts";
import { onCleanup } from "./cleanup.ts";
import { ProcessResult } from "./process-types.ts";

const processList = new Map<number, Deno.ChildProcess>();
let processCount = 0;
let cleanupRegistered = false;

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

// https://stackoverflow.com/a/77377871
async function* iteratorFromStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function execProcess(
  cmd: string,
  options: Deno.CommandOptions,
  stdin?: string,
  mergeOutput?: "stderr>stdout" | "stdout>stderr",
  stderrFilter?: (output: string) => string,
  respectStreams?: boolean,
): Promise<ProcessResult> {
  ensureCleanup();
  // define process
  try {
    // If the caller asked for stdout/stderr to be directed to the rid of an open
    // file, just allow that to happen. Otherwise, specify piped and we will implement
    // the proper behavior for inherit, etc....
    debug(`[execProcess] ${[cmd, ...(options.args ?? []).join(" ")]}`);
    const command = new Deno.Command(cmd, {
      ...options,
      stdin: stdin !== undefined ? "piped" : options.stdin,
      stdout: typeof (options.stdout) === "number" ? options.stdout : "piped",
      stderr: typeof (options.stderr) === "number" ? options.stderr : "piped",
    });
    const thisProcessId = ++processCount; // don't risk repeated PIDs
    const process = command.spawn();
    processList.set(thisProcessId, process);

    if (stdin !== undefined) {
      if (!process.stdin) {
        processList.delete(processCount);
        throw new Error("Process stdin not available");
      }
      const writer = process.stdin.getWriter();
      // write in 4k chunks (deno observed to overflow at > 64k)
      const kWindowSize = 4096;
      const buffer = new TextEncoder().encode(stdin);
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + kWindowSize, buffer.length);
        const window = buffer.subarray(offset, end);
        await writer.write(window);
        offset += window.byteLength;
      }
      process.stdin.close();
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
        stream: ReadableStream<Uint8Array> | null,
        filter?: (output: string) => string,
      ) => {
        if (stream !== null) {
          const iterator = iteratorFromStream(stream);
          const streamIter = filter
            ? filteredAsyncIterator(iterator, filter)
            : iterator;
          multiplexIterator.add(streamIter);
        }
      };
      addStream(process.stdout);
      addStream(process.stderr, stderrFilter);

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

      // Close the streams
      const closeStream = async (stream: ReadableStream<Uint8Array> | null) => {
        if (stream) {
          return stream.cancel();
        }
      };
      // await Promise.all([
      //   closeStream(process.stdout),
      //   closeStream(process.stderr),
      // ]);
    } else {
      // Process the streams independently
      const promises: Promise<void>[] = [];

      if (process.stdout !== null) {
        promises.push(
          processOutput(
            iteratorFromStream(process.stdout),
            options.stdout,
            respectStreams ? "stdout" : undefined,
          ).then((text) => {
            stdoutText = text;
          }),
        );
      }

      if (process.stderr != null) {
        const streamIterator = iteratorFromStream(process.stderr);
        const iterator = stderrFilter
          ? filteredAsyncIterator(streamIterator, stderrFilter)
          : streamIterator;
        promises.push(
          processOutput(
            iterator,
            options.stderr,
            respectStreams ? "stderr" : undefined,
          ).then((text) => {
            stderrText = text;
          }),
        );
      }
      await Promise.all(promises);
    }

    // await result
    const status = await process.output();

    // close the process

    processList.delete(thisProcessId);

    debug(`[execProcess] Success: ${status.success}, code: ${status.code}`);

    return {
      success: status.success,
      code: status.code,
      stdout: stdoutText,
      stderr: stderrText,
    };
  } catch (e) {
    throw new Error(`Error executing '${cmd}': ${e.message}`);
  }
}

export function processSuccessResult(): ProcessResult {
  return {
    success: true,
    code: 0,
  };
}

function filteredAsyncIterator(
  iterator: AsyncIterableIterator<Uint8Array>,
  filter: (output: string) => string,
): AsyncIterableIterator<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return pooledMap(1, iterator, (data: Uint8Array) => {
    return Promise.resolve(
      encoder.encode(filter(decoder.decode(data))),
    );
  });
}

// Processes ouptut from an interator (stderr, stdout, etc...)
async function processOutput(
  iterator: AsyncIterable<Uint8Array>,
  output?: "piped" | "inherit" | "null" | number,
  which?: "stdout" | "stderr",
): Promise<string> {
  const decoder = new TextDecoder();
  let outputText = "";
  for await (const chunk of iterator) {
    if (output === "inherit" || output === undefined) {
      if (which === "stdout") {
        Deno.stdout.writeSync(chunk);
      } else if (which === "stderr") {
        Deno.stderr.writeSync(chunk);
      } else {
        info(decoder.decode(chunk), { newline: false });
      }
    }
    const text = decoder.decode(chunk);
    outputText += text;
  }
  return outputText;
}
