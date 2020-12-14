import { Logger } from "./logger.ts";

export async function makeTarball(
  input: string,
  output: string,
  log: Logger,
) {
  log.info("Make Tarball");
  log.info(`Input: ${input}`);
  log.info(`Output: ${output}\n`);
  const tarCmd: string[] = [];
  tarCmd.push("tar");
  tarCmd.push("czvf");
  tarCmd.push(output);
  tarCmd.push(input);

  const p = Deno.run({
    cmd: tarCmd,
  });
  const status = await p.status();
  if (status.code !== 0) {
    throw Error("Failure to make tarball");
  }
}
