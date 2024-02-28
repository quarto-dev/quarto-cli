/*
 * yaml.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/exists.ts";
import { extname } from "../deno_ral/path.ts";

import { parse } from "yaml/mod.ts";
import { lines, matchAll, normalizeNewlines } from "./text.ts";
import { ErrorEx } from "./lib/error.ts";
import { getFrontMatterSchema } from "./lib/yaml-schema/front-matter.ts";

import {
  asMappedString,
  EitherString,
  mappedConcat,
  mappedNormalizeNewlines,
  MappedString,
  skipRegexp,
  skipRegexpAll,
} from "./mapped-text.ts";

import {
  readAndValidateYamlFromMappedString,
  ValidationError,
} from "./lib/yaml-schema/validated-yaml.ts";

/// YAML schema imports

import { Schema } from "yaml/schema.ts";
import { Type } from "yaml/type.ts";
import { bool, float, int, nil } from "yaml/_type/mod.ts";
import { failsafe } from "yaml/schema/failsafe.ts";

const kRegExBeginYAML = /^---[ \t]*$/;
const kRegExEndYAML = /^(?:---|\.\.\.)([ \t]*)$/;

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

const kRegxHTMLComment = /<!--[\W\w]*?-->/gm;
const kRegexFencedCode = /^([\t >]*`{3,})[^`\n]*\n[\W\w]*?\n\1\s*$/gm;

export function isYamlPath(file: string) {
  return [".yaml", ".yml"].includes(extname(file));
}

export function readYaml(file: string) {
  if (existsSync(file)) {
    const decoder = new TextDecoder("utf-8");
    const yml = Deno.readFileSync(file);
    const result = parseWithNiceErrors(decoder.decode(yml));
    try {
      JSON.stringify(result);
      return result;
    } catch (e) {
      throw new Error(
        `Circular structures not allowed.\nFile ${file}\n${
          e.message.split("\n").slice(1).join("\n")
        }`,
      );
    }
  } else {
    throw new Error(`YAML file ${file} not found.`);
  }
}

export function readYamlFromString(yml: string) {
  return parseWithNiceErrors(yml);
}

export function readYamlFromMarkdown(
  markdown: string,
): { [key: string]: unknown } {
  if (markdown) {
    // normalize newlines
    markdown = normalizeNewlines(markdown);

    // remove html comments and fenced code regions
    markdown = markdown.replaceAll(kRegxHTMLComment, "");
    markdown = markdown.replaceAll(kRegexFencedCode, "");

    // capture all yaml blocks as a single yaml doc
    let yaml = "";
    kRegExYAML.lastIndex = 0;
    let match = kRegExYAML.exec(markdown);
    while (match != null) {
      let yamlBlock = removeYamlDelimiters(match[2]);
      yamlBlock = lines(yamlBlock).map((x) => x.trimEnd()).join("\n");

      // exclude yaml blocks that start with a blank line, start with
      // a yaml delimiter (can occur if two "---" stack together) or
      // are entirely empty
      // (that's not valid for pandoc yaml blocks)
      if (
        !yamlBlock.match(/^\n\s*\n/) &&
        !yamlBlock.match(/^\n\s*\n---/m) &&
        (yamlBlock.trim().length > 0)
      ) {
        // surface errors immediately for invalid yaml
        parseWithNiceErrors(yamlBlock, {
          json: true,
          schema: QuartoJSONSchema,
        });
        // add it only if it's an actual block
        yaml += yamlBlock;
      }

      match = kRegExYAML.exec(markdown);
    }
    kRegExYAML.lastIndex = 0;

    // parse the yaml
    const metadata = parseWithNiceErrors(yaml, {
      json: true,
      schema: QuartoJSONSchema,
    });
    return (metadata || {}) as { [key: string]: unknown };
  } else {
    return {};
  }
}

export async function readAndValidateYamlFromMarkdown(
  eitherMarkdown: EitherString,
): Promise<{ [key: string]: unknown }> {
  let markdown = asMappedString(eitherMarkdown);
  if (!markdown.value) {
    return {};
  }
  // normalize newlines
  markdown = mappedNormalizeNewlines(markdown);

  // remove html comments and fenced code regions
  markdown = skipRegexpAll(markdown, kRegxHTMLComment);
  markdown = skipRegexpAll(markdown, kRegexFencedCode);

  const yaml = [];

  // capture all yaml blocks as a single yaml doc
  kRegExYAML.lastIndex = 0;
  for (const match of matchAll(markdown.value, kRegExYAML)) {
    const yamlBlock = removeYamlDelimitersMapped(match[2]);
    const yamlBlockValue = yamlBlock.value;

    // exclude yaml blocks that start with a blank line, start with
    // a yaml delimiter (can occur if two "---" stack together) or
    // are entirely empty
    // (that's not valid for pandoc yaml blocks)
    if (
      !yamlBlockValue.startsWith("\n\n") &&
      !yamlBlockValue.startsWith("\n---") &&
      (yamlBlockValue.trim().length > 0)
    ) {
      // surface errors immediately for invalid yaml
      parse(yamlBlockValue, { json: true, schema: QuartoJSONSchema });
      // add it
      yaml.push(yamlBlock);
    }
  }
  kRegExYAML.lastIndex = 0;

  if (yaml.length === 0) {
    return {};
  }

  const mappedYaml = mappedConcat(yaml);

  // parse the yaml
  const metadata = parseWithNiceErrors(mappedYaml.value, {
    json: true,
    schema: QuartoJSONSchema,
  }) as { [key: string]: unknown };

  if (metadata?.["validate-yaml"] as (boolean | undefined) !== false) {
    const schema = await getFrontMatterSchema();
    // we must validate it, so we go the slow route
    const {
      yaml,
      yamlValidationErrors,
    } = await readAndValidateYamlFromMappedString(mappedYaml, schema);

    if (yamlValidationErrors.length) {
      throw new ValidationError(
        "YAML front matter validation failed",
        yamlValidationErrors,
      );
    }
    return yaml;
  }
  return metadata;
}

export async function readYamlFromMarkdownFile(
  file: string,
): Promise<{ [key: string]: unknown }> {
  const markdown = Deno.readTextFileSync(file);
  const result = await readAndValidateYamlFromMarkdown(markdown);
  return result;
}

export function partitionYamlFrontMatter(
  markdown: string,
): { yaml: string; markdown: string } | null {
  // if there are are less than 3 lines or the first line isn't yaml then return null
  const mdLines = lines(markdown.trimLeft());
  if (mdLines.length < 3 || !mdLines[0].match(kRegExBeginYAML)) {
    return null;
    // if the second line is empty or has a --- then no go
  } else if (
    mdLines[1].trim().length === 0 || mdLines[1].match(kRegExEndYAML)
  ) {
    return null;
  } else {
    // if there is no end yaml position then return null
    const endYamlPos = mdLines.findIndex((line, index) =>
      index > 0 && line.match(kRegExEndYAML)
    );
    if (endYamlPos === -1) {
      return null;
    } else {
      return {
        yaml: mdLines.slice(0, endYamlPos + 1).join("\n"),
        markdown: "\n" + mdLines.slice(endYamlPos + 1).join("\n"),
      };
    }
  }
}

export function removeYamlDelimiters(yaml: string) {
  return yaml
    .replace(/^---/, "")
    .replace(/---\s*$/, "");
}

export function removeYamlDelimitersMapped(
  eitherYaml: EitherString,
): MappedString {
  let yaml = asMappedString(eitherYaml);
  yaml = skipRegexp(yaml, /^---/);
  yaml = skipRegexp(yaml, /---\s*$/);
  return yaml;
}

export class YAMLValidationError extends ErrorEx {
  constructor(message: string) {
    super("YAMLValidationError", message, false, false);
  }
}

/* Quarto yaml schema
*
* Note that this file needs to track the definitions in core/lib/yaml-intelligence/js-yaml-schema.ts, but we
* but we duplicate them here because lib uses js-yaml, and src/core uses the deno standard library.
*
* It's very possible that this file should be ported to use
* the core/lib parsing tools
*/

// Standard YAML's JSON schema + an expr tag handler ()
// http://www.yaml.org/spec/1.2/spec.html#id2803231
export const QuartoJSONSchema = new Schema({
  implicit: [nil, bool, int, float],
  include: [failsafe],
  explicit: [
    new Type("!expr", {
      kind: "scalar",
      construct(data): Record<string, unknown> {
        const result: string = data !== null ? data : "";
        return {
          value: result,
          tag: "!expr",
        };
      },
    }),
  ],
});

// TODO there's lots of work to do here.
// TODO take MappedString and fix line numbers
// TODO use the same error infrastructure as YAML validation
function parseWithNiceErrors(
  content: string,
  // deno-lint-ignore no-explicit-any
  options?: any,
) {
  try {
    return parse(content, options || { json: true, schema: QuartoJSONSchema });
  } catch (e) {
    throw improveYamlParseErrorMessage(e);
  }
}

function improveYamlParseErrorMessage(e: { message: string }) {
  if (e.message.match(/unknown tag/)) {
    e.message =
      `${e.message}\nDid you try to use a '!' in a YAML string? If so, you need to add explicit quotes to your string.`;
  }
  return e;
}
