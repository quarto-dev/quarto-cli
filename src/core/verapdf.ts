/*
 * verapdf.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info, warning } from "../deno_ral/log.ts";
import { basename, join } from "../deno_ral/path.ts";
import * as colors from "fmt/colors";

import { execProcess } from "./process.ts";
import { which } from "./path.ts";
import { quartoDataDir } from "./appdirs.ts";
import { existsSync } from "../deno_ral/fs.ts";
import { warnOnce } from "./log.ts";

const kVerapdfEnvVar = "QUARTO_VERAPDF";
const kVerapdfMainClass = "org.verapdf.apps.GreenfieldCliWrapper";

// verapdf flavours (profiles) supported for validation
// Maps quarto pdf-standard values to verapdf --flavour values
const kVerapdfFlavours: Record<string, string> = {
  // PDF/A standards
  "a-1a": "1a",
  "a-1b": "1b",
  "a-2a": "2a",
  "a-2b": "2b",
  "a-2u": "2u",
  "a-3a": "3a",
  "a-3b": "3b",
  "a-3u": "3u",
  "a-4": "4",
  "a-4e": "4e",
  "a-4f": "4f",
  // PDF/UA standards
  "ua-1": "ua1",
  "ua-2": "ua2",
};

// Standards that verapdf can validate (keys of the above map)
const kVerapdfSupportedStandards = new Set(Object.keys(kVerapdfFlavours));

/**
 * Check if a pdf-standard value can be validated by verapdf
 */
export function isVerapdfSupportedStandard(standard: string): boolean {
  const normalized = standard.toLowerCase().replace(/^pdf[/-]?/, "");
  return kVerapdfSupportedStandards.has(normalized);
}

/**
 * Get verapdf flavour for a pdf-standard value, or undefined if not supported
 */
export function getVerapdfFlavour(standard: string): string | undefined {
  const normalized = standard.toLowerCase().replace(/^pdf[/-]?/, "");
  return kVerapdfFlavours[normalized];
}

export interface VerapdfInvocation {
  cmd: string;
  args: string[];
}

/**
 * Build the verapdf command to execute.
 * Priority:
 *   1. QUARTO_VERAPDF env var (user override)
 *   2. Direct Java invocation with quarto-installed JAR
 *   3. System verapdf on PATH (fallback)
 */
export async function buildVerapdfCommand(
  flavour: string,
  pdfPath: string,
): Promise<VerapdfInvocation | undefined> {
  // Priority 1: QUARTO_VERAPDF env var
  const envOverride = Deno.env.get(kVerapdfEnvVar);
  if (envOverride) {
    // Check if it looks like a file path and doesn't exist
    const looksLikePath = envOverride.startsWith("/") ||
      envOverride.startsWith("./") ||
      envOverride.startsWith("~") ||
      /^[A-Za-z]:[\\/]/.test(envOverride);

    if (looksLikePath && !existsSync(envOverride)) {
      warnOnce(
        `Specified ${kVerapdfEnvVar} does not exist, using built-in verapdf`,
      );
    } else {
      info(`Using ${kVerapdfEnvVar}: ${envOverride}`);
      return {
        cmd: envOverride,
        args: ["-f", flavour, pdfPath],
      };
    }
  }

  // Priority 2: Direct Java invocation with quarto-installed JAR
  const quartoVerapdfDir = quartoDataDir("verapdf");
  const binDir = join(quartoVerapdfDir, "bin");

  if (existsSync(binDir)) {
    // Use direct Java invocation to avoid .bat issues on Windows
    const javaPath = await which("java");
    if (javaPath) {
      return {
        cmd: javaPath,
        args: [
          "-classpath",
          join(binDir, "*"),
          "-Dfile.encoding=UTF8",
          "-XX:+IgnoreUnrecognizedVMOptions",
          `-Dbasedir=${quartoVerapdfDir}`,
          "--add-exports=java.base/sun.security.pkcs=ALL-UNNAMED",
          kVerapdfMainClass,
          "-f",
          flavour,
          pdfPath,
        ],
      };
    }
  }

  // Priority 3: System verapdf on PATH
  const systemVerapdf = await which("verapdf");
  if (systemVerapdf) {
    return {
      cmd: systemVerapdf,
      args: ["-f", flavour, pdfPath],
    };
  }

  return undefined;
}

/**
 * Find verapdf binary path - checks quarto install location and PATH
 * @deprecated Use buildVerapdfCommand instead
 */
export async function findVerapdfPath(): Promise<string | undefined> {
  // Check quarto install location (bin directory for direct Java invocation)
  const quartoVerapdfDir = quartoDataDir("verapdf");
  const binDir = join(quartoVerapdfDir, "bin");

  if (existsSync(binDir)) {
    // Return the directory to indicate verapdf is installed
    // (actual invocation will use buildVerapdfCommand)
    return binDir;
  }

  // Fall back to system PATH
  const pathResult = await which("verapdf");
  if (pathResult) {
    return pathResult;
  }

  return undefined;
}

export interface VerapdfValidationResult {
  valid: boolean;
  flavour: string;
  errors: string[];
  output: string;
}

/**
 * Run verapdf validation on a PDF file
 */
export async function validatePdf(
  pdfPath: string,
  flavour: string,
  quiet = false,
): Promise<VerapdfValidationResult> {
  const invocation = await buildVerapdfCommand(flavour, pdfPath);
  if (!invocation) {
    throw new Error("verapdf not found");
  }

  if (!quiet) {
    info(
      `[verapdf]: Validating ${
        basename(pdfPath)
      } against PDF/${flavour.toUpperCase()}...`,
      { newline: false },
    );
  }

  const result = await execProcess({
    cmd: invocation.cmd,
    args: invocation.args,
    stdout: "piped",
    stderr: "piped",
  });

  const output = result.stdout || "";

  // Parse verapdf XML output to determine compliance
  // Look for isCompliant="true" in validationReport or compliant count in batchSummary
  const isCompliantMatch = output.match(/isCompliant="(true|false)"/);
  const batchSummaryMatch = output.match(
    /validationReports[^>]*compliant="(\d+)"[^>]*nonCompliant="(\d+)"/,
  );

  let valid = false;
  if (isCompliantMatch) {
    valid = isCompliantMatch[1] === "true";
  } else if (batchSummaryMatch) {
    const compliant = parseInt(batchSummaryMatch[1]);
    const nonCompliant = parseInt(batchSummaryMatch[2]);
    valid = nonCompliant === 0 && compliant > 0;
  } else {
    // Fallback: assume valid if exit code is 0 and no obvious failure indicators
    valid = result.success;
  }

  // Extract error messages from output when validation fails
  const errors: string[] = [];
  if (!valid) {
    // Look for failed rules with descriptions
    // Pattern: <rule ...><description>...</description>
    const ruleDescMatches = output.matchAll(
      /<rule[^>]*>[\s\S]*?<description>([^<]+)<\/description>/g,
    );
    for (const match of ruleDescMatches) {
      const desc = match[1].trim();
      if (desc && !errors.includes(desc)) {
        errors.push(desc);
      }
    }

    // Also look for clause violations in ruleId
    if (errors.length === 0) {
      const clauseMatches = output.matchAll(
        /<ruleId[^>]*clause="([^"]*)"[^>]*specification="([^"]*)"/g,
      );
      for (const match of clauseMatches) {
        errors.push(`${match[2]} clause ${match[1]} violation`);
      }
    }

    // Extract failedChecks count for summary
    const failedChecksMatch = output.match(/failedChecks="(\d+)"/);
    if (failedChecksMatch && parseInt(failedChecksMatch[1]) > 0) {
      const count = failedChecksMatch[1];
      if (errors.length === 0) {
        errors.push(`${count} compliance check(s) failed`);
      }
    }
  }

  if (!quiet) {
    if (valid) {
      info(colors.green("PASSED\n"));
    } else {
      info(colors.red("FAILED\n"));
    }
  }

  return {
    valid,
    flavour,
    errors,
    output,
  };
}

export interface PdfValidationOptions {
  quiet?: boolean;
  warnOnMissingVerapdf?: boolean;
}

/**
 * Validate a PDF against specified standards using verapdf
 * Returns true if all validations pass (or if no validatable standards specified)
 */
export async function validatePdfStandards(
  pdfPath: string,
  standards: string[],
  options: PdfValidationOptions = {},
): Promise<boolean> {
  const quiet = options.quiet ?? false;
  const warnOnMissingVerapdf = options.warnOnMissingVerapdf ?? true;

  // Filter to standards that verapdf can validate
  const validatableStandards: { standard: string; flavour: string }[] = [];
  const nonValidatableStandards: string[] = [];

  for (const standard of standards) {
    // Convert to string in case YAML parsed a version number (e.g., 2.0) as a number
    const standardStr = String(standard);
    const normalized = standardStr.toLowerCase().replace(/^pdf[/-]?/, "");
    // Skip version numbers (1.4, 1.5, etc.)
    if (/^\d+\.\d+$/.test(normalized)) {
      continue;
    }
    const flavour = getVerapdfFlavour(normalized);
    if (flavour) {
      validatableStandards.push({ standard: normalized, flavour });
    } else {
      nonValidatableStandards.push(standardStr);
    }
  }

  // Nothing to validate
  if (validatableStandards.length === 0) {
    return true;
  }

  // Check if verapdf is available
  const verapdfPath = await findVerapdfPath();
  if (!verapdfPath) {
    if (warnOnMissingVerapdf) {
      warning(
        `PDF standard validation requested but verapdf is not installed.\n` +
          `Install with: quarto install verapdf\n` +
          `Standards requested: ${
            validatableStandards.map((s) => s.standard).join(", ")
          }`,
      );
    }
    return true; // Don't fail the build, just warn
  }

  // Warn about standards we can't validate
  if (nonValidatableStandards.length > 0) {
    warning(
      `The following PDF standards cannot be validated by verapdf and will be skipped: ` +
        nonValidatableStandards.join(", "),
    );
  }

  // Run validation for each standard
  let allValid = true;
  for (const { standard, flavour } of validatableStandards) {
    try {
      const result = await validatePdf(pdfPath, flavour, quiet);
      if (!result.valid) {
        allValid = false;
        if (!quiet) {
          warning(
            `PDF validation failed for ${standard}:\n` +
              (result.errors.length > 0
                ? result.errors.slice(0, 5).join("\n")
                : "See verapdf output for details"),
          );
        }
      }
    } catch (error) {
      if (!quiet) {
        warning(`Failed to run verapdf validation: ${error}`);
      }
    }
  }

  return allValid;
}
