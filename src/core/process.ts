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

const processList = new Map<number, Deno.Process>();
let processCount = 0;
let cleanupRegistered = false;

function ensureCleanup() {
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    onCleanup(() => {
      for (const process of processList.values()) {
        try {
          process.kill();
          process.close();
        } catch (error) {
          info("Error occurred during cleanup: " + error);
        }
      }
    });
  }
}

export async function execProcess(
  options: Deno.RunOptions,
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
    debug(`[execProcess] ${options.cmd.join(" ")}`);
    const process = Deno.run({
      ...options,
      stdin: stdin !== undefined ? "piped" : options.stdin,
      stdout: typeof (options.stdout) === "number" ? options.stdout : "piped",
      stderr: typeof (options.stderr) === "number" ? options.stderr : "piped",
    });
    const thisProcessId = ++processCount; // don't risk repeated PIDs
    processList.set(thisProcessId, process);

    if (stdin !== undefined) {
      if (!process.stdin) {
        processList.delete(processCount);
        throw new Error("Process stdin not available");
      }
      // write in 4k chunks (deno observed to overflow at > 64k)
      const kWindowSize = 4096;
      const buffer = new TextEncoder().encode(stdin);
      let offset = 0;
      while (offset < buffer.length) {
        const end = Math.min(offset + kWindowSize, buffer.length);
        const window = buffer.subarray(offset, end);
        const written = await process.stdin.write(window);
        offset += written;
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
        stream: (Deno.Reader & Deno.Closer) | null,
        filter?: (output: string) => string,
      ) => {
        if (stream !== null) {
          const streamIter = filter
            ? filteredAsyncIterator(iterateReader(stream), filter)
            : iterateReader(stream);
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
      const closeStream = (stream: (Deno.Reader & Deno.Closer) | null) => {
        if (stream) {
          stream.close();
        }
      };
      closeStream(process.stdout);
      closeStream(process.stderr);
    } else {
      // Process the streams independently
      const promises: Promise<void>[] = [];

      if (process.stdout !== null) {
        promises.push(
          processOutput(
            iterateReader(process.stdout),
            options.stdout,
            respectStreams ? "stdout" : undefined,
          ).then((text) => {
            stdoutText = text;
            process.stdout!.close();
          }),
        );
      }

      if (process.stderr != null) {
        const iterator = stderrFilter
          ? filteredAsyncIterator(iterateReader(process.stderr), stderrFilter)
          : iterateReader(process.stderr);
        promises.push(
          processOutput(
            iterator,
            options.stderr,
            respectStreams ? "stderr" : undefined,
          ).then((text) => {
            stderrText = text;
            process.stderr!.close();
          }),
        );
      }
      await Promise.all(promises);
    }

    // await result
    const status = await process.status();

    // close the process
    process.close();

    processList.delete(thisProcessId);

    debug(`[execProcess] Success: ${status.success}, code: ${status.code}`);

    return {
      success: status.success,
      code: status.code,
      stdout: stdoutText,
      stderr: stderrText,
    };
  } catch (e) {
    throw new Error(`Error executing '${options.cmd[0]}': ${e.message}`);
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
