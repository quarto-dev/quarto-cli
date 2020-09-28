export interface ProcessResult {
  success: boolean;
  code: number;
  stdout?: string;
  stderr?: string;
}

export async function execProcess(
  options: Deno.RunOptions,
): Promise<ProcessResult> {
  // define process
  const process = Deno.run({
    cmd: options.cmd,
    stdout: options.stdout,
    stderr: options.stderr,
  });

  // await result
  const status = await process.status();
  const stdout = options.stdout === "piped"
    ? await process.output()
    : undefined;
  const stderr = options.stderr === "piped"
    ? await process.stderrOutput()
    : undefined;

  // return result
  const decoder = new TextDecoder();
  return {
    success: status.success,
    code: status.code,
    stdout: stdout ? decoder.decode(stdout) : undefined,
    stderr: stderr ? decoder.decode(stderr) : undefined,
  };
}
