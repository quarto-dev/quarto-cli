/**
 * find-tests.ts
 *
 * Find all .qmd files under a directory that target a given format.
 *
 * Usage:
 *   quarto run --dev tools/find-tests.ts <format> <directory>
 *
 * A document matches if the format name appears as:
 *   - The value of `format:` (string) in its YAML front matter
 *   - A key under `format:` (object) in its YAML front matter
 *   - A key under `_quarto.tests:` in its YAML front matter
 */

import { walk } from "../src/deno_ral/fs.ts";
import { readYamlFromMarkdown, readYaml } from "../src/core/yaml.ts";
import { dirname, join, relative } from "../src/deno_ral/path.ts";
import { existsSync } from "../src/deno_ral/fs.ts";

const [format, dir] = Deno.args;
if (!format || !dir) {
  console.error("Usage: quarto run tools/find-tests.ts <format> <directory>");
  Deno.exit(1);
}

function hasFormat(
  yaml: Record<string, unknown>,
  format: string,
): boolean {
  // Check format: <string> or format: { <format>: ... }
  const fmt = yaml["format"];
  if (typeof fmt === "string" && fmt === format) {
    return true;
  }
  if (fmt && typeof fmt === "object" && format in (fmt as Record<string, unknown>)) {
    return true;
  }

  // Check _quarto.tests.<format>
  const quarto = yaml["_quarto"] as Record<string, unknown> | undefined;
  if (quarto) {
    const tests = quarto["tests"] as Record<string, unknown> | undefined;
    if (tests && format in tests) {
      return true;
    }
  }

  return false;
}

for await (const entry of walk(dir, { exts: [".qmd"], includeDirs: false })) {
  try {
    const content = Deno.readTextFileSync(entry.path);
    const yaml = readYamlFromMarkdown(content) as Record<string, unknown>;
    if (hasFormat(yaml, format)) {
      console.log(relative(Deno.cwd(), entry.path));
      continue;
    }

    // Check _quarto.yml in the same directory and ancestors up to dir
    let current = dirname(entry.path);
    const root = Deno.realPathSync(dir);
    while (true) {
      const quartoYml = join(current, "_quarto.yml");
      if (existsSync(quartoYml)) {
        const projYaml = readYaml(quartoYml) as Record<string, unknown>;
        if (hasFormat(projYaml, format)) {
          console.log(relative(Deno.cwd(), entry.path));
          break;
        }
      }
      if (Deno.realPathSync(current) === root) break;
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {
    // skip files that can't be parsed
  }
}
