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
  const process = Deno.run(options);

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

  const stdoutText = stdout ? decoder.decode(stdout) : undefined;
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
