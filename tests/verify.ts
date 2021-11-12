/*
* verify.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { exists, existsSync } from "fs/exists.ts";
import { DOMParser } from "deno_dom/deno-dom-wasm-noinit.ts";
import { assert } from "testing/asserts.ts";
import { join } from "path/mod.ts";

import { readYamlFromString } from "../src/core/yaml.ts";

import { ExecuteOutput, Verify } from "./test.ts";
import { outputForInput } from "./utils.ts";
import { unzip } from "../src/core/zip.ts";
import { dirAndStem } from "../src/core/path.ts";

export const noErrorsOrWarnings: Verify = {
  name: "No Errors or Warnings",
  verify: (outputs: ExecuteOutput[]) => {
    const isErrorOrWarning = (output: ExecuteOutput) => {
      return output.levelName.toLowerCase() === "warning" ||
        output.levelName.toLowerCase() === "error";
    };

    const errorsOrWarnings = outputs.some(isErrorOrWarning);

    // Output an error or warning if it exists
    if (errorsOrWarnings) {
      const messages = outputs.filter(isErrorOrWarning).map((outputs) =>
        outputs.msg
      ).join("\n");

      assert(
        !errorsOrWarnings,
        `Error or Warnings During Execution\n|${messages}|`,
      );
    }

    return Promise.resolve();
  },
};

export const printsMessage = (
  level: "DEBUG" | "INFO" | "WARNING" | "ERROR",
  regex: RegExp,
): Verify => {
  return {
    name: `${level} matches ${String(regex)}`,
    verify: (outputs: ExecuteOutput[]) => {
      const printedMessage = outputs.some((output) => {
        return output.levelName === level && output.msg.match(regex);
      });
      assert(printedMessage, `Missing ${level} ${String(regex)}`);
      return Promise.resolve();
    },
  };
};

export const printsJson = {
  name: "Prints JSON Output",
  verify: (outputs: ExecuteOutput[]) => {
    outputs.filter((out) => out.msg !== "" && out.levelName === "INFO").forEach(
      (out) => {
        let json = undefined;
        try {
          json = JSON.parse(out.msg);
        } catch {
          assert(false, "Error parsing JSON returned by quarto meta");
        }
        assert(
          Object.keys(json).length > 0,
          "JSON returned by quarto meta seems invalid",
        );
      },
    );
    return Promise.resolve();
  },
};

export const fileExists = (file: string): Verify => {
  return {
    name: `File ${file} exists`,
    verify: (_output: ExecuteOutput[]) => {
      verifyPath(file);
      return Promise.resolve();
    },
  };
};

export const outputCreated = (input: string, to: string): Verify => {
  return {
    name: "Output Created",
    verify: (outputs: ExecuteOutput[]) => {
      // Check for output created message
      const outputCreatedMsg = outputs.find((outMsg) =>
        outMsg.msg.startsWith("Output created:")
      );
      assert(outputCreatedMsg !== undefined, "No output created message");

      // Check for existence of the output
      const outputFile = outputForInput(input, to);
      verifyPath(outputFile.outputPath);
      return Promise.resolve();
    },
  };
};

export const directoryEmptyButFor = (
  dir: string,
  allowedFiles: string[],
): Verify => {
  return {
    name: "Directory is empty",
    verify: (_outputs: ExecuteOutput[]) => {
      for (const item of Deno.readDirSync(dir)) {
        if (!allowedFiles.some((file) => item.name === file)) {
          assert(false, `Unexpected content ${item.name} in ${dir}`);
        }
      }
      return Promise.resolve();
    },
  };
};

export const ensureHtmlElements = (
  file: string,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return {
    name: "Inspecting HTML for Selectors",
    verify: async (_output: ExecuteOutput[]) => {
      const htmlInput = await Deno.readTextFile(file);
      const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
      selectors.forEach((sel) => {
        assert(
          doc.querySelector(sel) !== null,
          `Required DOM Element ${sel} is missing.`,
        );
      });

      if (noMatchSelectors) {
        noMatchSelectors.forEach((sel) => {
          assert(
            doc.querySelector(sel) === null,
            `Illegal DOM Element ${sel} is present.`,
          );
        });
      }
    },
  };
};

export const ensureFileRegexMatches = (
  file: string,
  matches: RegExp[],
  noMatches?: RegExp[],
): Verify => {
  return {
    name: `Inspecting ${file} for Regex matches`,
    verify: async (_output: ExecuteOutput[]) => {
      const tex = await Deno.readTextFile(file);
      matches.forEach((regex) => {
        assert(
          regex.test(tex),
          `Required match ${String(regex)} is missing from file ${file}.`,
        );
      });

      if (noMatches) {
        noMatches.forEach((regex) => {
          assert(
            !regex.test(tex),
            `Illegal match ${String(regex)} was found in file ${file}.`,
          );
        });
      }
    },
  };
};

export const ensureDocxRegexMatches = (
  file: string,
  regexes: RegExp[],
): Verify => {
  return {
    name: "Inspecting Docx for Regex matches",
    verify: async (_output: ExecuteOutput[]) => {
      const [_dir, stem] = dirAndStem(file);
      const temp = await Deno.makeTempDir();
      try {
        // Move the docx to a temp dir and unzip it
        const zipFile = join(temp, stem + ".zip");
        await Deno.rename(file, zipFile);
        await unzip(zipFile);

        // Open the core xml document and match the matches
        const docXml = join(temp, "word", "document.xml");
        const tex = await Deno.readTextFile(docXml);
        regexes.forEach((regex) => {
          assert(
            regex.test(tex),
            `Required DocX Element ${String(regex)} is missing.`,
          );
        });
      } finally {
        await Deno.remove(temp, { recursive: true });
      }
    },
  };
};

export function requireLatexPackage(pkg: string, opts?: string): RegExp {
  if (opts) {
    return RegExp(`\\\\usepackage\\[${opts}\\]{${pkg}}`, "g");
  } else {
    return RegExp(`\\\\usepackage{${pkg}}`, "g");
  }
}

export const noSupportingFiles = (input: string, to: string): Verify => {
  return {
    name: "No Supporting Files Dir",
    verify: (_output: ExecuteOutput[]) => {
      const outputFile = outputForInput(input, to);
      verifyNoPath(outputFile.supportPath);
      return Promise.resolve();
    },
  };
};

export const hasSupportingFiles = (input: string, to: string): Verify => {
  return {
    name: "Has Supporting Files Dir",
    verify: (_output: ExecuteOutput[]) => {
      const outputFile = outputForInput(input, to);
      verifyPath(outputFile.supportPath);
      return Promise.resolve();
    },
  };
};

export const verifyYamlFile = (
  file: string,
  func: (yaml: unknown) => boolean,
): Verify => {
  return {
    name: "Project Yaml is Valid",
    verify: async (_output: ExecuteOutput[]) => {
      if (await exists(file)) {
        const raw = await Deno.readTextFile(file);
        if (raw) {
          const yaml = readYamlFromString(raw);
          const isValid = func(yaml);
          assert(isValid, "Project Metadata isn't valid");
        }
      }
    },
  };
};

export function verifyPath(path: string) {
  const pathExists = existsSync(path);
  assert(pathExists, `Path ${path} doesn't exist`);
}

export function verifyNoPath(path: string) {
  const pathExists = existsSync(path);
  assert(!pathExists, `Unexpected directory: ${path}`);
}
