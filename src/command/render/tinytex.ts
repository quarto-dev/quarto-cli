import { basename, join } from "path/mod.ts";

import { dirAndStem, removeIfExists } from "../../core/path.ts";
import { execProcess, ProcessResult } from "../../core/process.ts";

export async function runTinytex(
  input: string,
  pdfEngine: string,
  pdfEngineArgs: string[],
  bibEngine: string,
): Promise<ProcessResult> {
  const [inputDir, inputStem] = dirAndStem(input);

  const result = await execProcess({
    cmd: ["pdflatex", basename(input)],
    cwd: inputDir,
  });
  if (!result.success) {
    return Promise.reject();
  }

  // cleanup intermediates
  ["toc", "out", "aux", "log"].forEach((ext) => {
    removeIfExists(join(inputDir, inputStem + "." + ext));
  });

  return result;
}
