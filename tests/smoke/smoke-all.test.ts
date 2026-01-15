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
import { os } from "../../src/deno_ral/platform.ts";
import { asArray } from "../../src/core/array.ts";

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { parse } from "../../src/core/yaml.ts";
import { cleanoutput } from "./render/render.ts";
import {
  ensureEpubFileRegexMatches,
  ensureDocxRegexMatches,
  ensureDocxXpath,
  ensureFileRegexMatches,
  ensureHtmlElements,
  ensurePdfRegexMatches,
  ensurePdfTextPositions,
  ensurePdfMetadata,
  ensureJatsXpath,
  ensureOdtXpath,
  ensurePptxRegexMatches,
  ensureTypstFileRegexMatches,
  ensureSnapshotMatches,
  fileExists,
  noErrors,
  noErrorsOrWarnings,
  ensurePptxXpath,
  ensurePptxLayout,
  ensurePptxMaxSlides,
  ensureLatexFileRegexMatches,
  printsMessage,
  shouldError,
  ensureHtmlElementContents,
  ensureHtmlElementCount,
} from "../verify.ts";
import { readYamlFromMarkdown } from "../../src/core/yaml.ts";
import { findProjectDir, findProjectOutputDir, outputForInput } from "../utils.ts";
import { jupyterNotebookToMarkdown } from "../../src/command/convert/jupyter.ts";
import { basename, dirname, join, relative } from "../../src/deno_ral/path.ts";
import { WalkEntry } from "../../src/deno_ral/fs.ts";
import { quarto } from "../../src/quarto.ts";
import { safeExistsSync, safeRemoveSync } from "../../src/core/path.ts";
import { runningInCI } from "../../src/core/ci-info.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

async function guessFormat(fileName: string): Promise<string[]> {
  const { cells } = await breakQuartoMd(Deno.readTextFileSync(fileName));

  const formats: Set<string> = new Set();

  for (const cell of cells) {
    if (cell.cell_type === "raw") {
      const src = cell.source.value.replaceAll(/^---$/mg, "");
      let yaml;
      try {
        yaml = parse(src);
      } catch (e) {
        if (!(e instanceof Error)) throw e;
        if (e.message.includes("unknown tag")) {
          // assume it's not necessary to guess the format
          continue;
        }
      }
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

function skipTest(metadata: Record<string, any>): string | undefined {
  // deno-lint-ignore no-explicit-any
  const quartoMeta = metadata["_quarto"] as any;
  const runConfig = quartoMeta?.tests?.run;

  // No run config means run everywhere
  if (!runConfig) {
    return undefined;
  }

  // Check explicit skip with message
  if (runConfig.skip) {
    return typeof runConfig.skip === "string" ? runConfig.skip : "tests.run.skip is true";
  }

  // Check CI
  if (runningInCI() && runConfig.ci === false) {
    return "tests.run.ci is false";
  }

  // Check OS blacklist (not_os)
  const notOs = runConfig.not_os;
  if (notOs !== undefined && asArray(notOs).includes(os)) {
    return `tests.run.not_os includes ${os}`;
  }

  // Check OS whitelist (os) - if specified, must match
  const onlyOs = runConfig.os;
  if (onlyOs !== undefined && !asArray(onlyOs).includes(os)) {
    return `tests.run.os does not include ${os}`;
  }

  return undefined;
}

//deno-lint-ignore no-explicit-any
function hasTestSpecs(metadata: any, input: string): boolean {
  const tests = metadata?.["_quarto"]?.["tests"];
  if (!tests && metadata?.["_quarto"]?.["test"] != undefined) {
    throw new Error(`Test is ${input} is using 'test' in metadata instead of 'tests'. This is probably a typo.`);
  }
  // Check if tests has any format specs (keys other than 'run')
  if (tests && typeof tests === "object") {
    const formatKeys = Object.keys(tests).filter(key => key !== "run");
    return formatKeys.length > 0;
  }
  return false;
}

interface QuartoInlineTestSpec {
  format: string;
  verifyFns: Verify[];
}

// Functions to cleanup leftover testing
const postRenderCleanupFiles: string[] = [];
function registerPostRenderCleanupFile(file: string): void {
  postRenderCleanupFiles.push(file);
}
const postRenderCleanup = () => {
  for (const file of postRenderCleanupFiles) {
    console.log(`Cleaning up ${file} in ${Deno.cwd()}`);
    if (safeExistsSync(file)) {
      Deno.removeSync(file);
    }
  }
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
    ensureEpubFileRegexMatches,
    ensureHtmlElements,
    ensureHtmlElementContents,
    ensureHtmlElementCount,
    ensureFileRegexMatches,
    ensureLatexFileRegexMatches,
    ensureTypstFileRegexMatches,
    ensureDocxRegexMatches,
    ensureDocxXpath,
    ensureOdtXpath,
    ensureJatsXpath,
    ensurePdfRegexMatches,
    ensurePdfTextPositions,
    ensurePdfMetadata,
    ensurePptxRegexMatches,
    ensurePptxXpath,
    ensurePptxLayout,
    ensurePptxMaxSlides,
    ensureSnapshotMatches,
    printsMessage
  };

  for (const [format, testObj] of Object.entries(specs)) {
    // Skip the 'run' key - it's not a format
    if (format === "run") {
      continue;
    }
    let checkWarnings = true;
    const verifyFns: Verify[] = [];
    if (testObj && typeof testObj === "object") {
      for (
        // deno-lint-ignore no-explicit-any
        const [key, value] of Object.entries(testObj as Record<string, any>)
      ) {
        if (key == "postRenderCleanup") {
          // This is a special key to register cleanup operations
          // each entry is a file to cleanup relative to the input file
          for (let file of value) {
            // if value has `${input_stem}` in the string, replace by input_stem value (input file name without extension)
            if (file.includes("${input_stem}")) {
              const extension = input.endsWith('.qmd') ? '.qmd' : '.ipynb';
              const inputStem = basename(input, extension);
              file = file.replace("${input_stem}", inputStem);
            }
            // file is registered for cleanup in testQuartoCmd teardown step
            registerPostRenderCleanupFile(join(dirname(input), file));
          }
        } else if (key == "shouldError") {
          checkWarnings = false;
          verifyFns.push(shouldError);
        } else if (key === "noErrors") {
          checkWarnings = false;
          verifyFns.push(noErrors);
        } else if (key === "noErrorsOrWarnings") {
          checkWarnings = false;
          verifyFns.push(noErrorsOrWarnings);
        } else {
          // See if there is a project and grab it's type
          const projectPath = findRootTestsProjectDir(input)
          const projectOutDir = findProjectOutputDir(projectPath);
          const outputFile = outputForInput(input, format, projectOutDir, projectPath, metadata);
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
          } else if (["ensurePptxLayout", "ensurePptxXpath"].includes(key)) {
            if (Array.isArray(value) && Array.isArray(value[0])) {
              // several slides to check
              value.forEach((slide: any) => {
                verifyFns.push(verifyMap[key](outputFile.outputPath, ...slide));
              });
            } else {
              verifyFns.push(verifyMap[key](outputFile.outputPath, ...value));
            }
          } else if (key === "printsMessage") {
            verifyFns.push(verifyMap[key](value));
          } else if (key === "ensureEpubFileRegexMatches") {
            // this ensure function is special because it takes an array of path + regex specifiers,
            // so we should never use the spread operator
            verifyFns.push(verifyMap[key](outputFile.outputPath, value));
          } else if (verifyMap[key]) {
            // FIXME: We should find another way that having this requirement of keep-* in the metadata
            if (key === "ensureTypstFileRegexMatches") {
              if (!metadata.format?.typst?.['keep-typ'] && !metadata['keep-typ'] && metadata.format?.typst?.['output-ext'] !== 'typ' && metadata['output-ext'] !== 'typ') {
                throw new Error(`Using ensureTypstFileRegexMatches requires setting 'keep-typ: true' in file ${input}`);
              }
            } else if (key === "ensureLatexFileRegexMatches") {
              if (!metadata.format?.pdf?.['keep-tex'] && !metadata['keep-tex']) {
                throw new Error(`Using ensureLatexFileRegexMatches requires setting 'keep-tex: true' in file ${input}`);
              }
            }

            // keep-typ/keep-tex files are alongside source, so pass input path
            // But output-ext: typ puts files in output directory, so don't pass input path
            const usesKeepTyp = key === "ensureTypstFileRegexMatches" &&
              (metadata.format?.typst?.['keep-typ'] || metadata['keep-typ']) &&
              !(metadata.format?.typst?.['output-ext'] === 'typ' || metadata['output-ext'] === 'typ');
            const usesKeepTex = key === "ensureLatexFileRegexMatches" &&
              (metadata.format?.pdf?.['keep-tex'] || metadata['keep-tex']);
            const needsInputPath = usesKeepTyp || usesKeepTex;
            if (typeof value === "object" && Array.isArray(value)) {
              // value is [matches, noMatches?] - ensure inputFile goes in the right position
              const matches = value[0];
              const noMatches = value[1];
              const inputFile = needsInputPath ? input : undefined;
              verifyFns.push(verifyMap[key](outputFile.outputPath, matches, noMatches, inputFile));
            } else {
              verifyFns.push(verifyMap[key](outputFile.outputPath, value, undefined, needsInputPath ? input : undefined));
            }
          } else {
            throw new Error(`Unknown verify function used: ${key} in file ${input} for format ${format}`) ;
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

// To store project path we render before testing file testSpecs
const renderedProjects: Set<string> = new Set();
// To store information of all the project we render so that we can cleanup after testing
const testedProjects: Set<string> = new Set();

// Create an array to hold all the promises for the tests of files
let testFilesPromises = [];

for (const { path: fileName } of files) {
  const input = relative(Deno.cwd(), fileName);
  
  const metadata = input.endsWith("md") // qmd or md
    ? readYamlFromMarkdown(Deno.readTextFileSync(input))
    : readYamlFromMarkdown(await jupyterNotebookToMarkdown(input, false));

  const skipReason = skipTest(metadata);
  if (skipReason !== undefined) {
    console.log(`Skipping tests for ${input}: ${skipReason}`);
    continue;
  }

  const testSpecs: QuartoInlineTestSpec[] = [];

  if (hasTestSpecs(metadata, input)) {
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

  // Get project path for this input and store it if this is a project (used for cleaning)
  const projectPath = findRootTestsProjectDir(input);
  if (projectPath) testedProjects.add(projectPath);

  // Render project before testing individual document if required
  if (
    (metadata["_quarto"] as any)?.["render-project"] && 
    projectPath && 
    !renderedProjects.has(projectPath)
  ) {
      await quarto(["render", projectPath]);
      renderedProjects.add(projectPath);
    }

  testFilesPromises.push(new Promise<void>(async (resolve, reject) => {
    try {

      // Create an array to hold all the promises for the testSpecs
      let testSpecPromises = [];
      
      for (const testSpec of testSpecs) {
        const {
          format,
          verifyFns,
          //deno-lint-ignore no-explicit-any
        } = testSpec as any;
        testSpecPromises.push(new Promise<void>((testSpecResolve, testSpecReject) => {
          try {
            if (format === "editor-support-crossref") {
              const tempFile = Deno.makeTempFileSync();
              testQuartoCmd("editor-support", ["crossref", "--input", input, "--output", tempFile], verifyFns, {
                teardown: () => {
                  Deno.removeSync(tempFile);
                  testSpecResolve(); // Resolve the promise for the testSpec
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
                  cleanoutput(input, format, undefined, undefined, metadata);
                  postRenderCleanup()
                  testSpecResolve(); // Resolve the promise for the testSpec
                  return Promise.resolve();
                },
              });
            }
          } catch (error) {
            testSpecReject(error);
          }
        }));
          
      }

      // Wait for all the promises to resolve
      await Promise.all(testSpecPromises);

      // Resolve the promise for the file
      resolve();

    } catch (error) {
      reject(error);
    }
  }));
}

// Wait for all the promises to resolve
// Meaning all the files have been tested and we can clean
Promise.all(testFilesPromises).then(() => {
  // Clean up any projects that were tested
  for (const project of testedProjects) {
    // Clean project output directory
    const projectOutDir = join(project, findProjectOutputDir(project));
    if (projectOutDir !== project && safeExistsSync(projectOutDir)) {
      safeRemoveSync(projectOutDir, { recursive: true });
    }
    // Clean hidden .quarto directory
    const hiddenQuarto = join(project, ".quarto");
    if (safeExistsSync(hiddenQuarto)) {
      safeRemoveSync(hiddenQuarto, { recursive: true });
    }
  }
}).catch((_error) => {});

function findRootTestsProjectDir(input: string) {
  const smokeAllRootDir = 'smoke-all$'
  const ffMatrixRootDir = 'feature-format-matrix[/]qmd-files$'

  const RootTestsRegex = new RegExp(`${smokeAllRootDir}|${ffMatrixRootDir}`);
  
  return findProjectDir(input, RootTestsRegex);
}