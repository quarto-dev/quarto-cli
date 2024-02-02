/*
 * smoke-all.test.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { expandGlobSync } from "../../src/core/deno/expand-glob.ts";
import { testQuartoCmd, Verify } from "../test.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../src/core/lib/yaml-validation/state.ts";

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { parse } from "yaml/mod.ts";
import { cleanoutput } from "./render/render.ts";
import {
  ensureDocxRegexMatches,
  ensureDocxXpath,
  ensureFileRegexMatches,
  ensureHtmlElements,
  ensureJatsXpath,
  ensureOdtXpath,
  ensurePptxRegexMatches,
  ensureTypstFileRegexMatches,
  ensureSnapshotMatches,
  fileExists,
  noErrors,
  noErrorsOrWarnings,
} from "../verify.ts";
import { readYaml, readYamlFromMarkdown } from "../../src/core/yaml.ts";
import { outputForInput } from "../utils.ts";
import { jupyterNotebookToMarkdown } from "../../src/command/convert/jupyter.ts";
import { basename, dirname, join, relative } from "path/mod.ts";
import { existsSync, WalkEntry } from "fs/mod.ts";
import { quarto } from "../../src/quarto.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

async function guessFormat(fileName: string): Promise<string[]> {
  const { cells } = await breakQuartoMd(Deno.readTextFileSync(fileName));

  const formats: Set<string> = new Set();

  for (const cell of cells) {
    if (cell.cell_type === "raw") {
      const src = cell.source.value.replaceAll(/^---$/mg, "");
      const yaml = parse(src);
      if (yaml && typeof yaml === "object") {
        // deno-lint-ignore no-explicit-any
        const format = (yaml as Record<string, any>).format;
        if (typeof format === "object") {
          for (
            const [k, _] of Object.entries(
              // deno-lint-ignore no-explicit-any
              (yaml as Record<string, any>).format || {},
            )
          ) {
            formats.add(k);
          }
        } else if (typeof format === "string") {
          formats.add(format);
        }
      }
    }
  }
  return Array.from(formats);
}

//deno-lint-ignore no-explicit-any
function hasTestSpecs(metadata: any): boolean {
  return metadata?.["_quarto"]?.["tests"] != undefined;
}

interface QuartoInlineTestSpec {
  format: string;
  verifyFns: Verify[];
}

function resolveTestSpecs(
  input: string,
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any>,
): QuartoInlineTestSpec[] {
  const specs = metadata["_quarto"]["tests"];

  const result = [];
  // deno-lint-ignore no-explicit-any
  const verifyMap: Record<string, any> = {
    ensureHtmlElements,
    ensureFileRegexMatches,
    ensureTypstFileRegexMatches,
    ensureDocxRegexMatches,
    ensureDocxXpath,
    ensureOdtXpath,
    ensureJatsXpath,
    ensurePptxRegexMatches,
    ensureSnapshotMatches
  };

  for (const [format, testObj] of Object.entries(specs)) {
    let checkWarnings = true;
    const verifyFns: Verify[] = [];
    if (testObj) {
      for (
        // deno-lint-ignore no-explicit-any
        const [key, value] of Object.entries(testObj as Record<string, any>)
      ) {
        if (key === "noErrors") {
          checkWarnings = false;
          verifyFns.push(noErrors);
        } else {
          // See if there is a project and grab it's type
          const projectOutDir = findProjectOutputDir(input);
          const outputFile = outputForInput(input, format, projectOutDir, metadata);
          if (key === "fileExists") {
            for (
              const [path, file] of Object.entries(
                value as Record<string, string>,
              )
            ) {
              if (path === "outputPath") {
                verifyFns.push(
                  fileExists(join(dirname(outputFile.outputPath), file)),
                );
              } else if (path === "supportPath") {
                verifyFns.push(
                  fileExists(join(outputFile.supportPath, file)),
                );
              }
            }
          } else if (verifyMap[key]) {
            if (typeof value === "object") {
              verifyFns.push(verifyMap[key](outputFile.outputPath, ...value));
            } else {
              verifyFns.push(verifyMap[key](outputFile.outputPath, value));
            }
          }
        }
      }
    }
    if (checkWarnings) {
      verifyFns.push(noErrorsOrWarnings);
    }

    result.push({
      format,
      verifyFns,
    });
  }
  return result;
}

await initYamlIntelligenceResourcesFromFilesystem();

// Ideally we'd just walk the one single glob here,
// but because smoke-all.test.ts ends up being called
// from a number of different places (including different shell
// scripts run under a variety of shells), it's
// actually non-trivial to guarantee that we'll see a single
// unexpanded glob pattern. So we assume that a pattern
// might have already been expanded here, and we also
// accommodate cases where it hasn't been expanded.
//
// (Do note that this means that files that don't exist will
// be silently ignored.)
const files: WalkEntry[] = [];
if (Deno.args.length === 0) {
  // ignore file starting with `_`
  files.push(...[...expandGlobSync("docs/smoke-all/**/*.{md,qmd,ipynb}")].filter((entry) => /^[^_]/.test(basename(entry.path))));
} else {
  for (const arg of Deno.args) {
    files.push(...expandGlobSync(arg));
  }
}

const renderedProjects: Set<string> = new Set();

for (const { path: fileName } of files) {
  const input = relative(Deno.cwd(), fileName);
  
  const metadata = input.endsWith("md") // qmd or md
    ? readYamlFromMarkdown(Deno.readTextFileSync(input))
    : readYamlFromMarkdown(await jupyterNotebookToMarkdown(input, false));
  const testSpecs = [];

  if (hasTestSpecs(metadata)) {
    testSpecs.push(...resolveTestSpecs(input, metadata));
  } else {
    const formats = await guessFormat(input);

    if (formats.length == 0) {
      formats.push("html");
    }
    for (const format of formats) {
      testSpecs.push({ format: format, verifyFns: [noErrorsOrWarnings] });
    }
  }

  // FIXME this will leave the project in a dirty state
  // tests run asynchronously so we can't clean up until all tests are done
  // and I don't know of a way to wait for that

  if ((metadata["_quarto"] as any)?.["render-project"]) {
    const projectPath = findProjectDir(input);
    if (projectPath && !renderedProjects.has(projectPath)) {
      await quarto(["render", projectPath]);
      renderedProjects.add(projectPath);
    }
  }

  for (const testSpec of testSpecs) {
    const {
      format,
      verifyFns,
      //deno-lint-ignore no-explicit-any
    } = testSpec as any;
    if (format === "editor-support-crossref") {
      const tempFile = Deno.makeTempFileSync();
      testQuartoCmd("editor-support", ["crossref", "--input", input, "--output", tempFile], verifyFns, {
        teardown: () => {
          Deno.removeSync(tempFile);
          return Promise.resolve();
        }
      }, `quarto editor-support crossref < ${input}`);
    } else {
      testQuartoCmd("render", [input, "--to", format], verifyFns, {
        prereq: async () => {
          setInitializer(fullInit);
          await initState();
          return Promise.resolve(true);
        },
        teardown: () => {
          cleanoutput(input, format, undefined, metadata);
          return Promise.resolve();
        },
      });
    }
  }
}

function findProjectDir(input: string): string | undefined {
  let dir = dirname(input);
  while (dir !== "" && dir !== ".") {
    const filename = ["_quarto.yml", "_quarto.yaml"].find((file) => {
      const yamlPath = join(dir, file);
      if (existsSync(yamlPath)) {
        return true;
      }
    });
    if (filename) {
      return dir;
    }

    const newDir = dirname(dir); // stops at the root for both Windows and Posix
    if (newDir === dir) {
      return;
    }
    dir = newDir;
  }
}

function findProjectOutputDir(input: string) {
  const dir = findProjectDir(input);
  if (!dir) {
    return;
  }
  const yaml = readYaml(join(dir, "_quarto.yml"));
  let type = undefined;
  try {
    // deno-lint-ignore no-explicit-any
    type = ((yaml as any).project as any).type;
  } catch (error) {
    throw new Error("Failed to read quarto project YAML", error);
  }

  if (type === "book") {
    return "_book";
  }
}