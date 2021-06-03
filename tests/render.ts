import { verifyAndCleanOutput, verifyNoPath } from "./verify.ts";
import { basename, dirname, extname, join } from "path/mod.ts";
import { assertEquals } from "testing/asserts.ts";
import { quartoCmd } from "./quarto-cmd.ts";

export function tryRender(
  input: string,
  to: string,
  verify: VoidFunction[],
  args?: string[],
) {
  const name = `Render: ${input} -> ${to}${
    args && args.length > 0 ? " (args:" + args.join(" ") + ")" : ""
  }`;
  Deno.test(name, async () => {
    await testRender(input, false, to), () => {
      verify.forEach((ver) => ver());
    };
  });
}

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

  const args = [inputFile];
  if (to) {
    args.push("--to");
    args.push(to);
  }
  if (quartoArgs) {
    args.push(...quartoArgs);
  }

  // run quarto
  const result = await quartoCmd("render", args);

  assertEquals(
    result.status.success,
    true,
    "Quarto returned non-zero status code",
  );

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
