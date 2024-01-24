/*
 * verify.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { DOMParser, NodeList } from "../src/core/deno-dom.ts";
import { assert } from "testing/asserts.ts";
import { join } from "path/mod.ts";
import { parseXmlDocument } from "slimdom";
import xpath from "fontoxpath";
import * as ld from "../src/core/lodash.ts";

import { readYamlFromString } from "../src/core/yaml.ts";

import { ExecuteOutput, Verify } from "./test.ts";
import { outputForInput } from "./utils.ts";
import { unzip } from "../src/core/zip.ts";
import { dirAndStem, which } from "../src/core/path.ts";
import { isWindows } from "../src/core/platform.ts";
import { execProcess } from "../src/core/process.ts";
import { checkSnapshot } from "./verify-snapshot.ts";

export const noErrors: Verify = {
  name: "No Errors",
  verify: (outputs: ExecuteOutput[]) => {
    const isError = (output: ExecuteOutput) => {
      return output.levelName.toLowerCase() === "error";
    };

    const errors = outputs.some(isError);

    // Output an error or warning if it exists
    if (errors) {
      const messages = outputs.filter(isError).map((outputs) => outputs.msg)
        .join("\n");

      assert(
        !errors,
        `Errors During Execution\n|${messages}|`,
      );
    }

    return Promise.resolve();
  },
};

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

export const validJsonFileExists = (file: string): Verify => {
  return {
    name: `Valid Json ${file} exists`,
    verify: (_output: ExecuteOutput[]) => {
      const jsonStr = Deno.readTextFileSync(file);
      JSON.parse(jsonStr);
      return Promise.resolve();
    }
  }
}

export const validJsonWithFields = (file: string, fields: Record<string, unknown>) => {
  return {
    name: `Valid Json ${file} exists`,
    verify: (_output: ExecuteOutput[]) => {
      const jsonStr = Deno.readTextFileSync(file);
      const json = JSON.parse(jsonStr);
      for (const key of Object.keys(fields)) {

        const value = json[key];
        assert(ld.isEqual(value, fields[key]), `Key ${key} has invalid value in json.`);
      }


      return Promise.resolve();
    }
  }
}

export const outputCreated = (
  input: string,
  to: string,
  projectOutDir?: string,
): Verify => {
  return {
    name: "Output Created",
    verify: (outputs: ExecuteOutput[]) => {
      // Check for output created message
      const outputCreatedMsg = outputs.find((outMsg) =>
        outMsg.msg.startsWith("Output created:")
      );
      assert(outputCreatedMsg !== undefined, "No output created message");

      // Check for existence of the output
      const outputFile = outputForInput(input, to, projectOutDir);
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

// FIXME: do this properly without resorting on file having keep-typ
export const ensureTypstFileRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  const asRegexp = (m: string | RegExp) => {
    if (typeof m === "string") {
      return new RegExp(m);
    } else {
      return m;
    }
  };
  const matches = matchesUntyped.map(asRegexp);
  const noMatches = noMatchesUntyped?.map(asRegexp);
  return {
    name: `Inspecting ${file} for Regex matches`,
    verify: async (_output: ExecuteOutput[]) => {
      const keptTyp = file.replace(".pdf", ".typ");
      const typ = await Deno.readTextFile(keptTyp);

      try {
        matches.forEach((regex) => {
          assert(
            regex.test(typ),
            `Required match ${String(regex)} is missing from file ${keptTyp}.`,
          );
        });

        if (noMatches) {
          noMatches.forEach((regex) => {
            assert(
              !regex.test(typ),
              `Illegal match ${String(regex)} was found in file ${keptTyp}.`,
            );
          });
        }
      } finally {
        await Deno.remove(keptTyp);
      }
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

export const ensureSnapshotMatches = (
  file: string,
): Verify => {
  return {
    name: "Inspecting Snapshot",
    verify: async (_output: ExecuteOutput[]) => {
      const good = await checkSnapshot(file);
      if (!good) {
        console.log("output:");
        console.log(await Deno.readTextFile(file));
        console.log("snapshot:");
        console.log(await Deno.readTextFile(file + ".snapshot"));
      }
      assert(
        good,
        `Snapshot ${file}.snapshot doesn't match output`,
      );
    },
  };
}

export const ensureFileRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  const asRegexp = (m: string | RegExp) => {
    if (typeof m === "string") {
      return new RegExp(m);
    } else {
      return m;
    }
  };
  const matches = matchesUntyped.map(asRegexp);
  const noMatches = noMatchesUntyped?.map(asRegexp);
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

export const verifyOdtDocument = (
  callback: (doc: string) => Promise<void>,
  name?: string,
): (file: string) => Verify => {
  return (file: string) => ({
    name: name ?? "Inspecting Odt",
    verify: async (_output: ExecuteOutput[]) => {
      const [_dir, stem] = dirAndStem(file);
      const temp = await Deno.makeTempDir();
      try {
        // Move the docx to a temp dir and unzip it
        const zipFile = join(temp, stem + ".zip");
        await Deno.rename(file, zipFile);
        await unzip(zipFile);

        // Open the core xml document and match the matches
        const docXml = join(temp, "content.xml");
        const xml = await Deno.readTextFile(docXml);
        await callback(xml);
      } finally {
        await Deno.remove(temp, { recursive: true });
      }
    },
  });
};

export const verifyJatsDocument = (
  callback: (doc: string) => Promise<void>,
  name?: string,
): (file: string) => Verify => {
  return (file: string) => ({
    name: name ?? "Inspecting Jats",
    verify: async (_output: ExecuteOutput[]) => {
      const xml = await Deno.readTextFile(file);
      await callback(xml);
    },
  });
};

export const verifyDocXDocument = (
  callback: (doc: string) => Promise<void>,
  name?: string,
): (file: string) => Verify => {
  return (file: string) => ({
    name: name ?? "Inspecting Docx",
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
        const xml = await Deno.readTextFile(docXml);
        await callback(xml);
      } finally {
        await Deno.remove(temp, { recursive: true });
      }
    },
  });
};

const xmlChecker = (
  selectors: string[],
  noMatchSelectors?: string[],
): (xmlText: string) => Promise<void> => {
  return (xmlText: string) => {
    const xmlDoc = parseXmlDocument(xmlText);
    for (const selector of selectors) {
      const xpathResult = xpath.evaluateXPath(selector, xmlDoc);
      const passes = (!Array.isArray(xpathResult) && xpathResult !== null) ||
        (Array.isArray(xpathResult) && xpathResult.length > 0);
      assert(
        passes,
        `Required XPath selector ${selector} returned empty array. Failing document follows:\n\n${xmlText}}`,
      );
    }
    for (const falseSelector of noMatchSelectors ?? []) {
      const xpathResult = xpath.evaluateXPath(falseSelector, xmlDoc);
      const passes = (!Array.isArray(xpathResult) && xpathResult !== null) ||
        (Array.isArray(xpathResult) && xpathResult.length > 0);
      assert(
        !passes,
        `Illegal XPath selector ${falseSelector} returned non-empty array. Failing document follows:\n\n${xmlText}}`,
      );
    }
    return Promise.resolve();
  };
};

export const ensureJatsXpath = (
  file: string,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return verifyJatsDocument(
    xmlChecker(selectors, noMatchSelectors),
    "Inspecting Jats for XPath selectors",
  )(file);
};

export const ensureOdtXpath = (
  file: string,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return verifyOdtDocument(
    xmlChecker(selectors, noMatchSelectors),
    "Inspecting Odt for XPath selectors",
  )(file);
};

export const ensureDocxXpath = (
  file: string,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return verifyDocXDocument(
    xmlChecker(selectors, noMatchSelectors),
    "Inspecting Docx for XPath selectors",
  )(file);
};

export const ensureDocxRegexMatches = (
  file: string,
  regexes: (string | RegExp)[],
): Verify => {
  return verifyDocXDocument((xml) => {
    regexes.forEach((regex) => {
      if (typeof regex === "string") {
        regex = new RegExp(regex);
      }
      assert(
        regex.test(xml),
        `Required DocX Element ${String(regex)} is missing.`,
      );
    });
    return Promise.resolve();
  }, "Inspecting Docx for Regex matches")(file);
};

// export const ensureDocxRegexMatches = (
//   file: string,
//   regexes: (string | RegExp)[],
// ): Verify => {
//   return {
//     name: "Inspecting Docx for Regex matches",
//     verify: async (_output: ExecuteOutput[]) => {
//       const [_dir, stem] = dirAndStem(file);
//       const temp = await Deno.makeTempDir();
//       try {
//         // Move the docx to a temp dir and unzip it
//         const zipFile = join(temp, stem + ".zip");
//         await Deno.rename(file, zipFile);
//         await unzip(zipFile);

//         // Open the core xml document and match the matches
//         const docXml = join(temp, "word", "document.xml");
//         const xml = await Deno.readTextFile(docXml);
//         regexes.forEach((regex) => {
//           if (typeof regex === "string") {
//             regex = new RegExp(regex);
//           }
//           assert(
//             regex.test(xml),
//             `Required DocX Element ${String(regex)} is missing.`,
//           );
//         });
//       } finally {
//         await Deno.remove(temp, { recursive: true });
//       }
//     },
//   };
// };

export const ensurePptxRegexMatches = (
  file: string,
  regexes: (string | RegExp)[],
  slideNumber: number,
): Verify => {
  return {
    name: "Inspecting Pptx for Regex matches",
    verify: async (_output: ExecuteOutput[]) => {
      const [_dir, stem] = dirAndStem(file);
      const temp = await Deno.makeTempDir();
      try {
        // Move the docx to a temp dir and unzip it
        const zipFile = join(temp, stem + ".zip");
        await Deno.rename(file, zipFile);
        await unzip(zipFile);

        // Open the core xml document and match the matches
        const slidePath = join(temp, "ppt", "slides");
        const slideFile = join(slidePath, `slide${slideNumber}.xml`);
        assert(
          existsSync(slideFile),
          `Slide number ${slideNumber} is not in the Pptx`,
        );
        const xml = await Deno.readTextFile(slideFile);
        regexes.forEach((regex) => {
          if (typeof regex === "string") {
            regex = new RegExp(regex);
          }
          assert(
            regex.test(xml),
            `Required Pptx Element ${String(regex)} is missing.`,
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

export const noSupportingFiles = (
  input: string,
  to: string,
  projectOutDir?: string,
): Verify => {
  return {
    name: "Verify No Supporting Files Dir",
    verify: (_output: ExecuteOutput[]) => {
      const outputFile = outputForInput(input, to, projectOutDir);
      verifyNoPath(outputFile.supportPath);
      return Promise.resolve();
    },
  };
};

export const hasSupportingFiles = (
  input: string,
  to: string,
  projectOutDir?: string,
): Verify => {
  return {
    name: "Has Supporting Files Dir",
    verify: (_output: ExecuteOutput[]) => {
      const outputFile = outputForInput(input, to, projectOutDir);
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
      if (existsSync(file)) {
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

export const ensureHtmlSelectorSatisfies = (
  file: string,
  selector: string,
  predicate: (list: NodeList) => boolean,
): Verify => {
  return {
    name: "Inspecting HTML for Selectors",
    verify: async (_output: ExecuteOutput[]) => {
      const htmlInput = await Deno.readTextFile(file);
      const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
      // quirk: deno claims the result of this is "NodeListPublic", which is not an exported type in deno-dom.
      // so we cast.
      const nodeList = doc.querySelectorAll(selector) as NodeList;
      assert(
        predicate(nodeList),
        `Selector ${selector} didn't satisfy predicate`,
      );
    },
  };
};

export const ensureXmlValidatesWithXsd = (
  file: string,
  xsdPath: string,
): Verify => {
  return {
    name: "Validating XML",
    verify: async (_output: ExecuteOutput[]) => {
      if (!isWindows()) {
        const cmd = ["xmllint", "--noout", "--valid", file, "--path", xsdPath];
        const runOptions: Deno.RunOptions = {
          cmd,
          stderr: "piped",
          stdout: "piped",
        };
        const result = await execProcess(runOptions);
        assert(
          result.success,
          `Failed XSD Validation for file ${file}\n${result.stderr}`,
        );
      }
    },
  };
};

export const ensureMECAValidates = (
  mecaFile: string,
): Verify => {
  return {
    name: "Validating MECA Archive",
    verify: async (_output: ExecuteOutput[]) => {
      if (Deno.build.os !== "windows") {
        const hasNpm = await which("npm");
        if (hasNpm) {
          const hasMeca = await which("meca");
          if (hasMeca) {
            const result = await execProcess({
              cmd: ["meca", "validate", mecaFile],
              stderr: "piped",
              stdout: "piped",
            });
            assert(
              result.success,
              `Failed MECA Validation\n${result.stderr}`,
            );
          } else {
            console.log("meca not present, skipping MECA validation");
          }
        } else {
          console.log("npm not present, skipping MECA validation");
        }
      }
    },
  };
};
