import { quarto } from "../src/quarto.ts";
import { verifyAndCleanOutput, verifyNoPath } from "./verify.ts";
import { basename, dirname, extname, join } from "path/mod.ts";

export async function testRender(
  inputFile: string,
  hasSupportingFiles = true,
  to?: string,
  quartoArgs?: string[],
  verify?: () => void,
) {
  const dir = dirname(inputFile);
  const stem = basename(inputFile, extname(inputFile));

  const outputExt = to || "html";

  const output = join(dir, `${stem}.${outputExt}`);
  const supportDir = join(dir, `${stem}_files`);

  const args = ["render", inputFile];
  if (to) {
    args.push("--to");
    args.push(to);
  }
  if (quartoArgs) {
    args.push(...quartoArgs);
  }

  // run quarto
  await quarto(args);

  if (verify) {
    verify();
  }

  verifyAndCleanOutput(output);
  if (hasSupportingFiles) {
    verifyAndCleanOutput(supportDir);
  } else {
    verifyNoPath(supportDir);
  }
}
