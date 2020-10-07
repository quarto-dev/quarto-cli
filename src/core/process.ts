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
    await process.stdin!.write(new TextEncoder().encode(stdin));
    process.stdin!.close();
  }

  // read from stdout
  const decoder = new TextDecoder();
  let stdoutText = "";
  if (stdout || options.stdout === "piped") {
    for await (const chunk of Deno.iter(process.stdout!)) {
      if (stdout) {
        stdout(chunk);
      }
      const text = decoder.decode(chunk);
      stdoutText += text;
    }
    process.stdout!.close();
  }

  // await result
  const status = await process.status();

  // collect stderr
  const stderr = options.stderr === "piped"
    ? await process.stderrOutput()
    : undefined;

  // return result
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
