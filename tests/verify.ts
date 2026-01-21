/*
 * verify.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, walkSync } from "../src/deno_ral/fs.ts";
import { DOMParser, NodeList } from "../src/core/deno-dom.ts";
import { assert } from "testing/asserts";
import { basename, dirname, join, relative, resolve } from "../src/deno_ral/path.ts";
import { parseXmlDocument } from "slimdom";
import xpath from "fontoxpath";
import * as ld from "../src/core/lodash.ts";

import { readYamlFromString } from "../src/core/yaml.ts";

import { ExecuteOutput, Verify } from "./test.ts";
import { outputForInput } from "./utils.ts";
import { unzip } from "../src/core/zip.ts";
import { dirAndStem, safeRemoveSync, which } from "../src/core/path.ts";
import { isWindows } from "../src/deno_ral/platform.ts";
import { execProcess, ExecProcessOptions } from "../src/core/process.ts";
import { checkSnapshot, generateSnapshotDiff, generateInlineDiff, WordDiffPart } from "./verify-snapshot.ts";
import * as colors from "fmt/colors";

export const withDocxContent = async <T>(
  file: string,
  k: (xml: string) => Promise<T>
) => {
  const [_dir, stem] = dirAndStem(file);
  const temp = await Deno.makeTempDir();
  try {
    // Move the docx to a temp dir and unzip it
    const zipFile = join(temp, stem + ".zip");
    await Deno.copyFile(file, zipFile);
    await unzip(zipFile);

    // Open the core xml document and match the matches
    const docXml = join(temp, "word", "document.xml");
    const xml = await Deno.readTextFile(docXml);
    const result = await k(xml);
    return result;
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
};

export const withEpubDirectory = async <T>(
  file: string,
  k: (path: string) => Promise<T>
) => {
  const [_dir, stem] = dirAndStem(file);
  const temp = await Deno.makeTempDir();
  try {
    // Move the docx to a temp dir and unzip it
    const zipFile = join(temp, stem + ".zip");
    await Deno.copyFile(file, zipFile);
    await unzip(zipFile);

    // Open the core xml document and match the matches
    const result = await k(temp);
    return result;
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
};

export const withPptxContent = async <T>(
  file: string,
  slideNumber: number,
  rels: boolean,
  // takes the parsed XML and the XML file path
  k: (xml: string, xmlFile: string) => Promise<T>,
  isSlideMax: boolean = false,
) => {
  const [_dir, stem] = dirAndStem(file);
  const temp = await Deno.makeTempDir();
  try {
    // Move the pptx to a temp dir and unzip it
    const zipFile = join(temp, stem + ".zip");
    await Deno.copyFile(file, zipFile);
    await unzip(zipFile);

    // Open the core xml document and match the matches
    const slidePath = join(temp, "ppt", "slides");
    let slideFile = join(slidePath, rels ? join("_rels", `slide${slideNumber}.xml.rels`) : `slide${slideNumber}.xml`);
    assert(
      existsSync(slideFile),
      `Slide number ${slideNumber} is not in the Pptx`,
    );
    if (isSlideMax) {
      assert(
        !existsSync(join(slidePath, `slide${slideNumber + 1}.xml`)),
        `Pptx has more than ${slideNumber} slides.`,
      );
      return Promise.resolve();
    } else {
      const xml = await Deno.readTextFile(slideFile);
      const result = await k(xml, slideFile);
      return result;
    }
  } finally {
    await Deno.remove(temp, { recursive: true });
  }
};

const checkErrors = (outputs: ExecuteOutput[]): { errors: boolean, messages: string | undefined } => {
  const isError = (output: ExecuteOutput) => {
    return output.levelName.toLowerCase() === "error";
  };
  const errors = outputs.some(isError);

  const messages = errors ? outputs.filter(isError).map((outputs) => outputs.msg).join("\n") : undefined

  return({
    errors,
    messages
  })
}

export const noErrors: Verify = {
  name: "No Errors",
  verify: (outputs: ExecuteOutput[]) => {
    
    const { errors, messages } = checkErrors(outputs);

    assert(
      !errors,
      `Errors During Execution\n|${messages}|`,
    );

    return Promise.resolve();
  },
};

export const shouldError: Verify = {
  name: "Should Error",
  verify: (outputs: ExecuteOutput[]) => {

    const { errors } = checkErrors(outputs);

    assert(
      errors,
      `No errors during execution while rendering was expected to fail.`,
    );

    return Promise.resolve();
  },
};

export const noErrorsOrWarnings: Verify = {
  name: "No Errors or Warnings",
  verify: (outputs: ExecuteOutput[]) => {
    const isErrorOrWarning = (output: ExecuteOutput) => {
      return output.levelName.toLowerCase() === "warn" ||
        output.levelName.toLowerCase() === "error";
        // I'd like to do this but many many of our tests
        // would fail right now because we're assuming noErrorsOrWarnings
        // doesn't include warnings from the lua subsystem
        //  ||
        // output.msg.startsWith("(W)"); // this is a warning from quarto.log.warning()
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

export const printsMessage = (options: {
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  regex: string | RegExp;
  negate?: boolean;
}): Verify => {
  const { level, regex: regexPattern, negate = false } = options;  // Set default here
  return {
    name: `${level} matches ${String(regexPattern)}`,
    verify: (outputs: ExecuteOutput[]) => {
      const regex = typeof regexPattern === "string" 
      ? new RegExp(regexPattern) 
      : regexPattern;

      const printedMessage = outputs.some((output) => {
        return output.levelName === level && output.msg.match(regex);
      });
      assert(
        negate ? !printedMessage : printedMessage, 
        `${negate ? "Found" : "Missing"} ${level} ${String(regex)}`
      );
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

export const pathDoNotExists = (path: string): Verify => {
  return {
    name: `path ${path} do not exists`,
    verify: (_output: ExecuteOutput[]) => {
      verifyNoPath(path);
      return Promise.resolve();
    },
  };
};

export const directoryContainsOnlyAllowedPaths = (dir: string, paths: string[]): Verify => {
  return {
    name: `Ensure only has ${paths.length} paths in folder`,
    verify: (_output: ExecuteOutput[]) => {

      for (const walk of walkSync(dir)) {
        const path = relative(dir, walk.path);
        if (path !== "") {
          assert(paths.includes(path), `Unexpected path ${path} encountered.`); 
  
        }
      }    
      return Promise.resolve();
    },
  };
}

export const folderExists = (path: string): Verify => {
  return {
    name: `Folder ${path} exists`,
    verify: (_output: ExecuteOutput[]) => {
      verifyPath(path);
      assert(Deno.statSync(path).isDirectory, `Path ${path} isn't a folder`);
      return Promise.resolve();
    },
  }; 
}

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

export const ensureHtmlElements = (
  file: string,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return {
    name: `Inspecting HTML for Selectors in ${file}`,
    verify: async (_output: ExecuteOutput[]) => {
      const htmlInput = await Deno.readTextFile(file);
      const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
      selectors.forEach((sel) => {
        assert(
          doc.querySelector(sel) !== null,
          `Required DOM Element ${sel} is missing in ${file}.`,
        );
      });

      if (noMatchSelectors) {
        noMatchSelectors.forEach((sel) => {
          assert(
            doc.querySelector(sel) === null,
            `Illegal DOM Element ${sel} is present in ${file}.`,
          );
        });
      }
    },
  };
};

export const ensureHtmlElementContents = (
  file: string, 
  options : {
    selectors: string[],
    matches: (string | RegExp)[],
    noMatches?: (string | RegExp)[]
  }
) => {
  return {
    name: "Inspecting HTML for Selector Contents",
    verify: async (_output: ExecuteOutput[]) => {
      const htmlInput = await Deno.readTextFile(file);
      const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
      options.selectors.forEach((sel) => {
        const el = doc.querySelector(sel);
        if (el !== null) {
          const contents = el.innerText;
          options.matches.forEach((regex) => {
            assert(
              asRegexp(regex).test(contents),
              `Required match ${String(regex)} is missing from selector ${sel} content: ${contents}.`,
            );
          });

          options.noMatches?.forEach((regex) => {
            assert(
              !asRegexp(regex).test(contents),
              `Unexpected match ${String(regex)} is present from selector ${sel} content: ${contents}.`,
            );
          });
  
        }
      });
    },
  };

}

export const ensureHtmlElementCount = (
  file: string,
  options: {
    selectors: string[] | string,
    counts: number[] | number
  }
): Verify => {
  return {
    name: "Verify number of elements for selectors",
    verify: async (_output: ExecuteOutput[]) => {
      const htmlInput = await Deno.readTextFile(file);
      const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;
      
      // Convert single values to arrays for unified processing
      const selectorsArray = Array.isArray(options.selectors) ? options.selectors : [options.selectors];
      const countsArray = Array.isArray(options.counts) ? options.counts : [options.counts];
      
      if (selectorsArray.length !== countsArray.length) {
        throw new Error("Selectors and counts arrays must have the same length");
      }
      
      selectorsArray.forEach((selector, index) => {
        const expectedCount = countsArray[index];
        const elements = doc.querySelectorAll(selector);
        assert(
          elements.length === expectedCount,
          `Selector '${selector}' matched ${elements.length} elements, expected ${expectedCount}.`
        );
      });
    }
  };
};

const printColoredDiff = (diff: string) => {
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      console.log(colors.green(line));
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      console.log(colors.red(line));
    } else if (line.startsWith("@@")) {
      console.log(colors.dim(line));
    } else {
      console.log(line);
    }
  }
};

const escapeWhitespace = (s: string): string => {
  return s.replace(/\n/g, "⏎\\n").replace(/\t/g, "→\\t").replace(/ /g, "·");
};

const printCompactInlineDiff = (parts: WordDiffPart[]) => {
  const chunks: string[] = [];
  let currentChunk = "";
  let hasChanges = false;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.added || part.removed) {
      hasChanges = true;
      const displayValue = /^\s+$/.test(part.value) ? escapeWhitespace(part.value) : part.value;
      if (part.added) {
        currentChunk += colors.bgGreen(colors.black(displayValue));
      } else {
        currentChunk += colors.bgRed(colors.white(displayValue));
      }
    } else {
      if (hasChanges) {
        const contextBefore = part.value.slice(0, 40);
        chunks.push(currentChunk + colors.dim(contextBefore + (part.value.length > 40 ? "..." : "")));
        currentChunk = "";
        hasChanges = false;
      }
      const nextHasChange = parts.slice(i + 1).some(p => p.added || p.removed);
      if (nextHasChange) {
        const contextAfter = part.value.slice(-40);
        currentChunk = colors.dim((part.value.length > 40 ? "..." : "") + contextAfter);
      }
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  for (const chunk of chunks) {
    console.log(chunk);
    console.log("");
  }
};

export const ensureSnapshotMatches = (
  file: string,
): Verify => {
  return {
    name: "Inspecting Snapshot",
    verify: async (_output: ExecuteOutput[]) => {
      const good = await checkSnapshot(file);
      const diffFile = file + ".diff";
      if (!good) {
        const diff = await generateSnapshotDiff(file);
        const inlineParts = await generateInlineDiff(file);

        await Deno.writeTextFile(diffFile, diff);
        console.log(`\nDiff saved to: ${diffFile}`);

        console.log("\n--- Unified Diff ---");
        printColoredDiff(diff);
        console.log("--- End Unified Diff ---\n");

        console.log("--- Word-level Changes (with context) ---");
        printCompactInlineDiff(inlineParts);
        console.log("--- End Word-level Changes ---\n");
      } else {
        safeRemoveSync(diffFile);
      }
      assert(
        good,
        `Snapshot ${file}.snapshot doesn't match output`,
      );
    },
  };
}

const regexChecker = async function(file: string, matches: RegExp[], noMatches: RegExp[] | undefined) {
  const content = await Deno.readTextFile(file);
  matches.forEach((regex) => {
    assert(
      regex.test(content),
      `Required match ${String(regex)} is missing from file ${file}.`,
    );
  });

  if (noMatches) {
    noMatches.forEach((regex) => {
      assert(
        !regex.test(content),
        `Illegal match ${String(regex)} was found in file ${file}.`,
      );
    });
  }
}

export const verifyFileRegexMatches = (
  callback: (file: string, matches: RegExp[], noMatches: RegExp[] | undefined) => Promise<void>,
  name?: string,
): (file: string, matchesUntyped: (string | RegExp)[], noMatchesUntyped?: (string | RegExp)[]) => Verify => {
  return (file: string, matchesUntyped: (string | RegExp)[], noMatchesUntyped?: (string | RegExp)[]) => {
    // Use mutliline flag for regexes so that ^ and $ can be used
    const asRegexp = (m: string | RegExp) => {
      if (typeof m === "string") {
        return new RegExp(m, "m");
      } else {
        return m;
      }
    };
    const matches = matchesUntyped.map(asRegexp);
    const noMatches = noMatchesUntyped?.map(asRegexp);
    return {
      name: name ?? `Inspecting ${file} for Regex matches`,
      verify: async (_output: ExecuteOutput[]) => {
        const tex = await Deno.readTextFile(file);
        await callback(file, matches, noMatches);
      }
    };
  }
}

// Use this function to Regex match text in the output file
export const ensureFileRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  return(verifyFileRegexMatches(regexChecker)(file, matchesUntyped, noMatchesUntyped));
};

// Verify the .llms.md companion file for an HTML output.
// Used when testing websites with llms-txt: true enabled.
export const ensureLlmsMdRegexMatches = (
  htmlFile: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  const llmsFile = htmlFile.replace(/\.html$/, ".llms.md");
  return verifyFileRegexMatches(regexChecker, `Inspecting ${llmsFile} for Regex matches`)(llmsFile, matchesUntyped, noMatchesUntyped);
};

// Verify the .llms.md companion file exists for an HTML output.
export const ensureLlmsMdExists = (htmlFile: string): Verify => {
  const llmsFile = htmlFile.replace(/\.html$/, ".llms.md");
  return {
    name: `File ${llmsFile} exists`,
    verify: (_output: ExecuteOutput[]) => {
      verifyPath(llmsFile);
      return Promise.resolve();
    },
  };
};

// Verify the .llms.md companion file does NOT exist for an HTML output.
export const ensureLlmsMdDoesNotExist = (htmlFile: string): Verify => {
  const llmsFile = htmlFile.replace(/\.html$/, ".llms.md");
  return {
    name: `File ${llmsFile} does not exist`,
    verify: (_output: ExecuteOutput[]) => {
      verifyNoPath(llmsFile);
      return Promise.resolve();
    },
  };
};

// Verify the llms.txt index file in a website output directory.
export const ensureLlmsTxtRegexMatches = (
  outputDir: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  const llmsTxtPath = join(outputDir, "llms.txt");
  return verifyFileRegexMatches(regexChecker, `Inspecting ${llmsTxtPath} for Regex matches`)(llmsTxtPath, matchesUntyped, noMatchesUntyped);
};

// Verify the llms.txt file exists in a website output directory.
export const ensureLlmsTxtExists = (outputDir: string): Verify => {
  const llmsTxtPath = join(outputDir, "llms.txt");
  return {
    name: `File ${llmsTxtPath} exists`,
    verify: (_output: ExecuteOutput[]) => {
      verifyPath(llmsTxtPath);
      return Promise.resolve();
    },
  };
};

// Verify the llms.txt file does NOT exist in a website output directory.
export const ensureLlmsTxtDoesNotExist = (outputDir: string): Verify => {
  const llmsTxtPath = join(outputDir, "llms.txt");
  return {
    name: `File ${llmsTxtPath} does not exist`,
    verify: (_output: ExecuteOutput[]) => {
      verifyNoPath(llmsTxtPath);
      return Promise.resolve();
    },
  };
};

// Use this function to Regex match text in the intermediate kept file
// FIXME: do this properly without resorting on file having keep-*
// Note: keep-typ/keep-tex places files alongside source, not in output dir
export const verifyKeepFileRegexMatches = (
  toExt: string,
  keepExt: string,
): (file: string, matchesUntyped: (string | RegExp)[], noMatchesUntyped?: (string | RegExp)[], inputFile?: string) => Verify => {
  return (file: string, matchesUntyped: (string | RegExp)[], noMatchesUntyped?: (string | RegExp)[], inputFile?: string) => {
    // Kept files are alongside source, so derive from inputFile if provided
    const keptFile = inputFile
      ? join(dirname(inputFile), basename(file).replace(`.${toExt}`, `.${keepExt}`))
      : file.replace(`.${toExt}`, `.${keepExt}`);
    const keptFileChecker = async (file: string, matches: RegExp[], noMatches: RegExp[] | undefined) => {
      try {
        await regexChecker(file, matches, noMatches);
      } finally {
        if (!Deno.env.get("QUARTO_TEST_KEEP_OUTPUTS")) {
          await safeRemoveSync(file);
        }
      }
    }
    return verifyFileRegexMatches(keptFileChecker, `Inspecting intermediate ${keptFile} for Regex matches`)(keptFile, matchesUntyped, noMatchesUntyped);
  }
};

// FIXME: do this properly without resorting on file having keep-typ
export const ensureTypstFileRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
  inputFile?: string,
): Verify => {
  return(verifyKeepFileRegexMatches("pdf", "typ")(file, matchesUntyped, noMatchesUntyped, inputFile));
};

// FIXME: do this properly without resorting on file having keep-tex
export const ensureLatexFileRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
  inputFile?: string,
): Verify => {
  return(verifyKeepFileRegexMatches("pdf", "tex")(file, matchesUntyped, noMatchesUntyped, inputFile));
};

// Use this function to Regex match text in a rendered PDF file
// This requires pdftotext to be available on PATH
export const ensurePdfRegexMatches = (
  file: string,
  matchesUntyped: (string | RegExp)[],
  noMatchesUntyped?: (string | RegExp)[],
): Verify => {
  const matches = matchesUntyped.map(asRegexp);
  const noMatches = noMatchesUntyped?.map(asRegexp);
  return {
    name: `Inspecting ${file} for Regex matches`,
    verify: async (_output: ExecuteOutput[]) => {
      const cmd = new Deno.Command("pdftotext", {
        args: [file, "-"],
        stdout: "piped",
      })
      const output = await cmd.output();
      assert(output.success, `Failed to extract text from ${file}.`)
      const text = new TextDecoder().decode(output.stdout);

      matches.forEach((regex) => {
        assert(
          regex.test(text),
          `Required match ${String(regex)} is missing from file ${file}.`,
        );
      });

      if (noMatches) {
        noMatches.forEach((regex) => {
          assert(
            !regex.test(text),
            `Illegal match ${String(regex)} was found in file ${file}.`,
          );
        });
      }
    },
  };
}

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

export const verifyOdtDocument = (
  callback: (doc: string) => Promise<void>,
  name?: string,
): (file: string) => Verify => {
  return (file: string) => ({
    name: name ?? "Inspecting Odt",
    verify: async (_output: ExecuteOutput[]) => {
      return await withDocxContent(file, callback);
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
      return await withDocxContent(file, callback);
    },
  });
};

export const verifyEpubDocument = (
  callback: (path: string) => Promise<void>,
  name?: string,
): (file: string) => Verify => {
  return (file: string) => ({
    name: name ?? "Inspecting Epub",
    verify: async (_output: ExecuteOutput[]) => {
      return await withEpubDirectory(file, callback);
    },
  });
}

export const verifyPptxDocument = (
  callback: (doc: string, docFile: string) => Promise<void>,
  name?: string,
): (file: string, slideNumber: number, rels?: boolean, isSlideMax?: boolean) => Verify => {
  return (file: string, slideNumber: number, rels: boolean = false, isSlideMax: boolean = false) => ({
    name: name ?? "Inspecting Pptx",
    verify: async (_output: ExecuteOutput[]) => {
      return await withPptxContent(file, slideNumber, rels, callback, isSlideMax);
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

const pptxLayoutChecker = (layoutName: string): (xmlText: string, xmlFile: string) => Promise<void> => {
  return async (xmlText: string, xmlFile: string) => {
    // Parse the XML from slide#.xml.rels
    const xmlDoc = parseXmlDocument(xmlText);

    // Select the Relationship element with the correct Type attribute
    const relationshipSelector = "/Relationships/Relationship[substring(@Type, string-length(@Type) - string-length('relationships/slideLayout') + 1) = 'relationships/slideLayout']/@Target";
    const slideLayoutFile = xpath.evaluateXPathToString(relationshipSelector, xmlDoc);

    assert(
      slideLayoutFile,
      `Required XPath selector ${relationshipSelector} returned empty string. Failing document ${basename(xmlFile)} follows:\n\n${xmlText}}`,
    );

    // Construct the full path to the slide layout file
    // slideLayoutFile is a relative path from the slide xm document, that the `_rels` equivalent was about
    const layoutFilePath = resolve(dirname(dirname(xmlFile)), slideLayoutFile);

    // Now we need to check the slide layout file
    const layoutXml = Deno.readTextFileSync(layoutFilePath);

    // Parse the XML from slideLayout#.xml
    const layoutDoc = parseXmlDocument(layoutXml);

    // Select the p:cSld element with the correct name attribute
    const layoutSelector = '//p:cSld/@name';
    const layout = xpath.evaluateXPathToString(layoutSelector, layoutDoc);
    assert(
      layout === layoutName,
      `Slides is not using "${layoutName}" layout - Current value: "${layout}". Failing document ${basename(layoutFilePath)} follows:\n\n${layoutXml}}`,
    );

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

export const ensurePptxXpath = (
  file: string,
  slideNumber: number,
  selectors: string[],
  noMatchSelectors?: string[],
): Verify => {
  return verifyPptxDocument(
    xmlChecker(selectors, noMatchSelectors),
    `Inspecting Pptx for XPath selectors on slide ${slideNumber}`,
  )(file, slideNumber);
};

export const ensurePptxLayout = (
  file: string,
  slideNumber: number,
  layoutName: string,
): Verify => {
  return verifyPptxDocument(
    pptxLayoutChecker(layoutName),
    `Inspecting Pptx for slide ${slideNumber} having layout ${layoutName}.`,
  )(file, slideNumber, true);
};

export const ensurePptxMaxSlides = (
  file: string,
  slideNumberMax: number,
): Verify => {
  return verifyPptxDocument(
    // callback won't be used here
    () => Promise.resolve(),
    `Checking Pptx for maximum ${slideNumberMax} slides`,
  )(file, slideNumberMax, true);
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

export const ensureEpubFileRegexMatches = (
  epubFile: string,
  pathsAndRegexes: {
    path: string;
    regexes: (string | RegExp)[][];
  }[]
): Verify => {
  return verifyEpubDocument(async (epubDir) => {
    for (const { path, regexes } of pathsAndRegexes) {
      const file = join(epubDir, path);
      assert(
        existsSync(file),
        `File ${file} doesn't exist in Epub`,
      );
      const content = await Deno.readTextFile(file);
      const mustMatch: (RegExp | string)[] = [];
      const mustNotMatch: (RegExp | string)[] = [];
      if (regexes.length) {
        mustMatch.push(...regexes[0]);
      }
      if (regexes.length > 1) {
        mustNotMatch.push(...regexes[1]);
      }

      mustMatch.forEach((regex) => {
        if (typeof regex === "string") {
          regex = new RegExp(regex);
        }
        assert(
          regex.test(content),
          `Required match ${String(regex)} is missing from file ${file}.`,
        );
      });
      mustNotMatch.forEach((regex) => {
        if (typeof regex === "string") {
          regex = new RegExp(regex);
        }
        assert(
          !regex.test(content),
          `Illegal match ${String(regex)} was found in file ${file}.`,
        );
      });
    }
  }, "Inspecting Epub for Regex matches")(epubFile);
}

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
  assert(!pathExists, `Unexpected path: ${path}`);
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
      if (!isWindows) {
        const args = ["--noout", "--valid", file, "--path", xsdPath];
        const runOptions: ExecProcessOptions = {
          cmd: "xmllint", 
          args,
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
      if (!isWindows) {
        const hasNpm = await which("npm");
        if (hasNpm) {
          const hasMeca = await which("meca");
          if (hasMeca) {
            const result = await execProcess({
              cmd: "meca", 
              args: ["validate", mecaFile],
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


const asRegexp = (m: string | RegExp) => {
  if (typeof m === "string") {
    return new RegExp(m);
  } else {
    return m;
  }
};

// Re-export ensurePdfTextPositions from dedicated module
export { ensurePdfTextPositions } from "./verify-pdf-text-position.ts";

// Re-export ensurePdfMetadata from dedicated module
export { ensurePdfMetadata } from "./verify-pdf-metadata.ts";
