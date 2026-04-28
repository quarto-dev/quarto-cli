/*
 * output-typst.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "../../deno_ral/path.ts";
import {
  copySync,
  ensureDirSync,
  existsSync,
  safeRemoveSync,
} from "../../deno_ral/fs.ts";
import {
  builtinSubtreeExtensions,
  inputExtensionDirs,
  readExtensions,
  readSubtreeExtensions,
} from "../../extension/extension.ts";
import { projectScratchPath } from "../../project/project-scratch.ts";
import { resourcePath } from "../../core/resources.ts";

import {
  kFontPaths,
  kKeepTyp,
  kOutputExt,
  kOutputFile,
  kPdfStandard,
  kVariant,
  pdfStandardEnv,
} from "../../config/constants.ts";
import { error, warning } from "../../deno_ral/log.ts";
import { ErrorEx } from "../../core/lib/error.ts";
import { Format } from "../../config/types.ts";
import { writeFileToStdout } from "../../core/console.ts";
import { dirAndStem, expandPath } from "../../core/path.ts";
import { kStdOut, replacePandocOutputArg } from "./flags.ts";
import { OutputRecipe, RenderOptions } from "./types.ts";
import { normalizeOutputPath } from "./output-shared.ts";
import {
  typstCompile,
  TypstCompileOptions,
  validateRequiredTypstVersion,
} from "../../core/typst.ts";
import { runAnalyze, toTomlPath } from "../../core/typst-gather.ts";
import { asArray } from "../../core/array.ts";
import { ProjectContext } from "../../project/types.ts";
import { validatePdfStandards } from "../../core/verapdf.ts";

export interface NeededPackage {
  namespace: string;
  name: string;
  version: string;
}

// Collect all package source directories (built-in + extensions)
async function collectPackageSources(
  inputDir: string,
  projectDir: string,
): Promise<string[]> {
  const sources: string[] = [];

  // 1. Built-in packages
  const builtinPackages = resourcePath("formats/typst/packages");
  if (existsSync(builtinPackages)) {
    sources.push(builtinPackages);
  }

  // 2. Extension packages
  const extensionDirs = inputExtensionDirs(inputDir, projectDir);
  const subtreePath = builtinSubtreeExtensions();
  for (const extDir of extensionDirs) {
    const extensions = extDir === subtreePath
      ? await readSubtreeExtensions(extDir)
      : await readExtensions(extDir);
    for (const ext of extensions) {
      const packagesDir = join(ext.path, "typst/packages");
      if (existsSync(packagesDir)) {
        sources.push(packagesDir);
      }
    }
  }

  return sources;
}

// Build the TOML config string for typst-gather analyze
export function buildAnalyzeToml(
  typstInput: string,
  packageSources: string[],
): string {
  const discoverPath = toTomlPath(typstInput);
  const cachePaths = packageSources.map((p) => `"${toTomlPath(p)}"`).join(", ");

  return [
    `discover = ["${discoverPath}"]`,
    `package-cache = [${cachePaths}]`,
  ].join("\n");
}

// Run typst-gather analyze on the .typ file to determine needed packages
async function analyzeNeededPackages(
  typstInput: string,
  packageSources: string[],
): Promise<NeededPackage[] | null> {
  const tomlConfig = buildAnalyzeToml(typstInput, packageSources);

  try {
    const result = await runAnalyze(tomlConfig);
    return result.imports.map(({ namespace, name, version }) => ({
      namespace,
      name,
      version,
    }));
  } catch (e) {
    // Fallback: if analyze fails, stage everything (current behavior)
    const detail = e instanceof Error ? e.message : String(e);
    warning(
      `typst-gather analyze failed; staging all packages as fallback: ${detail}`,
    );
    return null;
  }
}

// Stage only the needed packages from source dirs into the cache dir.
// Last write wins — extensions (listed after built-in) override built-in packages.
export function stageSelectedPackages(
  sources: string[],
  cacheDir: string,
  needed: NeededPackage[] | null,
): void {
  if (needed === null) {
    stageAllPackages(sources, cacheDir);
    return;
  }

  for (const pkg of needed) {
    const relPath = join(pkg.namespace, pkg.name, pkg.version);
    const destPath = join(cacheDir, relPath);

    for (const source of sources) {
      const srcPath = join(source, relPath);
      if (existsSync(srcPath)) {
        ensureDirSync(dirname(destPath));
        copySync(srcPath, destPath, { overwrite: true });
      }
    }
  }
}

// Fallback: copy all packages from all sources. Last write wins at the
// package directory level. Built-in listed first, extensions after.
export function stageAllPackages(sources: string[], cacheDir: string): void {
  for (const source of sources) {
    for (const nsEntry of Deno.readDirSync(source)) {
      if (!nsEntry.isDirectory) continue;
      const nsSrc = join(source, nsEntry.name);
      const nsDest = join(cacheDir, nsEntry.name);
      ensureDirSync(nsDest);
      for (const pkgEntry of Deno.readDirSync(nsSrc)) {
        const pkgSrc = join(nsSrc, pkgEntry.name);
        const pkgDest = join(nsDest, pkgEntry.name);
        copySync(pkgSrc, pkgDest, { overwrite: true });
      }
    }
  }
}

// Stage typst packages to .quarto/typst-packages/
// First stages built-in packages, then extension packages (which can override)
async function stageTypstPackages(
  inputDir: string,
  typstInput: string,
  projectDir?: string,
): Promise<string | undefined> {
  if (!projectDir) {
    return undefined;
  }

  const packageSources = await collectPackageSources(inputDir, projectDir);
  if (packageSources.length === 0) {
    return undefined;
  }

  const neededPackages = await analyzeNeededPackages(
    typstInput,
    packageSources,
  );

  const cacheDir = projectScratchPath(projectDir, "typst/packages");
  stageSelectedPackages(packageSources, cacheDir, neededPackages);

  return cacheDir;
}

export function useTypstPdfOutputRecipe(
  format: Format,
) {
  return format.pandoc.to === "typst" &&
    format.render[kOutputExt] === "pdf";
}

export function typstPdfOutputRecipe(
  input: string,
  finalOutput: string,
  options: RenderOptions,
  format: Format,
  project?: ProjectContext,
): OutputRecipe {
  // calculate output and args for pandoc (this is an intermediate file
  // which we will then compile to a pdf and rename to .typ)
  const [inputDir, inputStem] = dirAndStem(input);
  const output = inputStem + ".typ";
  let args = options.pandocArgs || [];
  const pandoc = { ...format.pandoc };
  if (options.flags?.output) {
    args = replacePandocOutputArg(args, output);
  } else {
    pandoc[kOutputFile] = output;
  }

  // when pandoc is done, we need to run the pdf generator and then copy the
  // output to the user's requested destination
  const complete = async () => {
    // input file is pandoc's output
    const typstInput = join(inputDir, output);

    // run typst
    await validateRequiredTypstVersion();
    const pdfOutput = join(inputDir, inputStem + ".pdf");
    const typstOptions: TypstCompileOptions = {
      quiet: options.flags?.quiet,
      fontPaths: (asArray(format.metadata?.[kFontPaths]) as string[]).map(
        (p) => isAbsolute(p) ? p : resolve(inputDir, p),
      ),
      pdfStandard: normalizePdfStandardForTypst(
        asArray(
          format.render?.[kPdfStandard] ?? format.metadata?.[kPdfStandard] ??
            pdfStandardEnv(),
        ),
      ),
    };
    if (project?.dir) {
      typstOptions.rootDir = project.dir;

      // Stage extension typst packages
      const packagePath = await stageTypstPackages(
        inputDir,
        typstInput,
        project.dir,
      );
      if (packagePath) {
        typstOptions.packagePath = packagePath;
      }
    }
    const result = await typstCompile(
      typstInput,
      pdfOutput,
      typstOptions,
    );
    if (!result.success) {
      if (result.stderr) {
        error(result.stderr);
      }
      throw new ErrorEx("Error", "Typst compilation failed", false, false);
    }

    // Validate PDF against specified standards using verapdf (if available)
    const pdfStandards = asArray(
      format.render?.[kPdfStandard] ?? format.metadata?.[kPdfStandard] ??
        pdfStandardEnv(),
    ) as string[];
    if (pdfStandards.length > 0) {
      await validatePdfStandards(pdfOutput, pdfStandards, {
        quiet: options.flags?.quiet,
      });
    }

    // keep typ if requested
    if (!format.render[kKeepTyp]) {
      safeRemoveSync(typstInput);
    }

    // copy (or write for stdout) compiled pdf to final output location
    if (finalOutput) {
      if (finalOutput === kStdOut) {
        writeFileToStdout(pdfOutput);
        safeRemoveSync(pdfOutput);
      } else {
        const outputPdf = expandPath(finalOutput);

        if (normalize(pdfOutput) !== normalize(outputPdf)) {
          // ensure the target directory exists
          ensureDirSync(dirname(outputPdf));
          Deno.renameSync(pdfOutput, outputPdf);
        }
      }

      // final output needs to either absolute or input dir relative
      // (however it may be working dir relative when it is passed in)
      return normalizeOutputPath(typstInput, finalOutput);
    } else {
      return normalizeOutputPath(typstInput, pdfOutput);
    }
  };

  const pdfOutput = finalOutput
    ? finalOutput === kStdOut
      ? undefined
      : normalizeOutputPath(input, finalOutput)
    : normalizeOutputPath(input, join(inputDir, inputStem + ".pdf"));

  // return recipe
  const recipe: OutputRecipe = {
    output,
    keepYaml: false,
    args,
    format: { ...format, pandoc },
    complete,
    finalOutput: pdfOutput ? relative(inputDir, pdfOutput) : undefined,
  };

  // if we have some variant declared, resolve it
  // (use for opt-out citations extension)
  if (format.render?.[kVariant]) {
    const to = format.pandoc.to;
    const variant = format.render[kVariant];

    recipe.format = {
      ...recipe.format,
      pandoc: {
        ...recipe.format.pandoc,
        to: `${to}${variant}`,
      },
    };
  }

  return recipe;
}

// Typst-supported PDF standards
const kTypstSupportedStandards = new Set([
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "2.0",
  "a-1b",
  "a-1a",
  "a-2b",
  "a-2u",
  "a-2a",
  "a-3b",
  "a-3u",
  "a-3a",
  "a-4",
  "a-4f",
  "a-4e",
  "ua-1",
]);

function normalizePdfStandardForTypst(standards: unknown[]): string[] {
  const result: string[] = [];
  for (const s of standards) {
    // Convert to string - YAML may parse versions like 2.0 as integer 2
    let str: string;
    if (typeof s === "number") {
      // Handle YAML numeric parsing: integer 2 -> "2.0", float 1.4 -> "1.4"
      str = Number.isInteger(s) ? `${s}.0` : String(s);
    } else if (typeof s === "string") {
      str = s;
    } else {
      continue;
    }
    // Normalize: lowercase, remove any "pdf" prefix
    const normalized = str.toLowerCase().replace(/^pdf[/-]?/, "");
    if (kTypstSupportedStandards.has(normalized)) {
      result.push(normalized);
    } else {
      warning(
        `PDF standard '${s}' is not supported by Typst and will be ignored`,
      );
    }
  }
  return result;
}
