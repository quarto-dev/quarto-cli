/*
* quarto-cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
// Quarto Reponse
export interface QuartoResult {
  status: Deno.ProcessStatus;
  stderr: string;
  stdout: string;
}

// Execute a Quarto Command, capturing output
export async function quartoCmd(
  cmd: string,
  args: string[],
): Promise<QuartoResult> {
  const quartoCommand = ["quarto", cmd, ...args];
  const p = Deno.run({
    cmd: quartoCommand,
    stdout: "piped",
    stderr: "piped",
  });
  const stdout = new TextDecoder().decode(await p.output());
  const stderr = new TextDecoder().decode(await p.stderrOutput());
  const status = await p.status();
  if (status.code !== 0) {
    throw Error(`Command ${cmd} failed.`);
  }

  // Close the child process
  p.close();

  return {
    status,
    stdout,
    stderr,
  };
}
