/*
* process.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

export interface ProcessResult {
  success: boolean;
  code: number;
  stdout?: string;
  stderr?: string;
}

export async function execProcess(
  options: Deno.RunOptions,
  stdin?: string,
  stdout?: (data: Uint8Array) => void,
): Promise<ProcessResult> {
  // define process
  const process = Deno.run({
    ...options,
    stdin: stdin ? "piped" : options.stdin,
    stdout: stdout ? "piped" : options.stdout,
  });

  if (stdin) {
    if (!process.stdin) {
      throw new Error("Process stdin not available");
    }
    await process.stdin.write(new TextEncoder().encode(stdin));
    process.stdin.close();
  }

  // read from stdout
  const decoder = new TextDecoder();
  let stdoutText = "";
  if (stdout || options.stdout === "piped") {
    if (!process.stdout) {
      throw new Error("Process stdout not available");
    }

    for await (const chunk of Deno.iter(process.stdout)) {
      if (stdout) {
        stdout(chunk);
      }
      const text = decoder.decode(chunk);
      stdoutText += text;
    }
    process.stdout.close();
  }

  // await result
  const status = await process.status();

  // collect stderr
  const stderr = options.stderr === "piped"
    ? await process.stderrOutput()
    : undefined;
  const stderrText = stderr ? decoder.decode(stderr) : undefined;

  // close the process
  process.close();

  return {
    success: status.success,
    code: status.code,
    stdout: stdoutText,
    stderr: stderrText,
  };
}

export function processSuccessResult(): ProcessResult {
  return {
    success: true,
    code: 0,
  };
}
