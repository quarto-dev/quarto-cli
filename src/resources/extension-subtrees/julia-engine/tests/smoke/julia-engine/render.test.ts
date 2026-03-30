import { assert, assertMatch } from "jsr:@std/assert";
import { join } from "jsr:@std/path";
import { existsSync } from "jsr:@std/fs/exists";

const isWindows = Deno.build.os === "windows";
function quartoCmd(): string {
  return isWindows ? "quarto.cmd" : "quarto";
}
function docs(path: string): string {
  return join("docs", path);
}

function renderQmd(
  file: string,
  args: string[] = [],
  cwd?: string,
): Deno.CommandOutput {
  const allArgs = ["render", file, ...args];
  const output = new Deno.Command(quartoCmd(), { args: allArgs, cwd })
    .outputSync();
  if (!output.success) {
    console.error("Render failed:");
    console.error("stdout:\n" + new TextDecoder().decode(output.stdout));
    console.error("stderr:\n" + new TextDecoder().decode(output.stderr));
    throw new Error(`quarto render ${file} failed`);
  }
  return output;
}

Deno.test("source ranges with includes", async () => {
  const dir = docs("julia-engine/source-ranges");
  const input = join(dir, "source-ranges-test.qmd");
  renderQmd(input, ["--to", "markdown"]);

  const outputFile = join(dir, "source-ranges-test.md");
  assert(existsSync(outputFile), `Output file ${outputFile} should exist`);
  const content = await Deno.readTextFile(outputFile);

  // The julia code outputs __FILE__:__LINE__. Verify source range mapping:
  // line 10 of source-ranges-test.qmd and line 2 of _included.qmd
  assertMatch(content, /source-ranges-test\.qmd:10/m);
  assertMatch(content, /_included\.qmd:2/m);

  try { Deno.removeSync(outputFile); } catch { /* ok */ }
});

Deno.test("engine reordering", () => {
  const dir = docs("julia-engine/engine-reordering");
  renderQmd("notebook.qmd", ["--to", "html"], dir);

  const outputFile = join(dir, "notebook.html");
  assert(existsSync(outputFile), `Output file ${outputFile} should exist`);

  try { Deno.removeSync(outputFile); } catch { /* ok */ }
});
