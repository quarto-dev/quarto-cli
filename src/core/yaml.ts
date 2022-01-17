/*
* yaml.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";

import { JSON_SCHEMA, parse } from "encoding/yaml.ts";
import { lines, matchAll, normalizeNewlines } from "./text.ts";
import { getFrontMatterSchema } from "./schema/front-matter.ts";

import {
  asMappedString,
  EitherString,
  mappedConcat,
  mappedNormalizeNewlines,
  MappedString,
  skipRegexp,
  skipRegexpAll,
} from "./mapped-text.ts";

import { readAndValidateYamlFromMappedString } from "./schema/validated-yaml.ts";

const kRegExBeginYAML = /^---[ \t]*$/;
const kRegExEndYAML = /^(?:---|\.\.\.)([ \t]*)$/;

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

const kRegxHTMLComment = /<!--[\W\w]*?-->/gm;
const kRegexFencedCode = /^([\t >]*`{3,})[^`\n]*\n[\W\w]*?\n\1\s*$/gm;

export function readYaml(file: string) {
  if (existsSync(file)) {
    const decoder = new TextDecoder("utf-8");
    const yml = Deno.readFileSync(file);
    return parse(decoder.decode(yml), { schema: JSON_SCHEMA });
  } else {
    throw new Error(`YAML file ${file} not found.`);
  }
}

export function readYamlFromString(yml: string) {
  return parse(yml, { schema: JSON_SCHEMA });
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
      const yamlBlock = removeYamlDelimiters(match[2]);

      // exclude yaml blocks that start with a blank line, start with
      // a yaml delimiter (can occur if two "---" stack together) or
      // are entirely empty
      // (that's not valid for pandoc yaml blocks)
      if (
        !yamlBlock.startsWith("\n\n") &&
        !yamlBlock.startsWith("\n---") &&
        (yamlBlock.trim().length > 0)
      ) {
        // surface errors immediately for invalid yaml
        parse(yamlBlock, { json: true, schema: JSON_SCHEMA });
        // add it
        yaml += yamlBlock;
      }

      match = kRegExYAML.exec(markdown);
    }
    kRegExYAML.lastIndex = 0;

    // parse the yaml
    const metadata = parse(yaml, { json: true, schema: JSON_SCHEMA });
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
      parse(yamlBlockValue, { json: true, schema: JSON_SCHEMA });
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
  const metadata = parse(mappedYaml.value, {
    json: true,
    schema: JSON_SCHEMA,
  }) as { [key: string]: unknown };

  if (metadata?.["validate-yaml"] as (boolean | undefined) === false) {
    // we must validate it, so we go the slow route
    return readAndValidateYamlFromMappedString(
      mappedYaml,
      await getFrontMatterSchema(),
      "YAML front matter validation failed",
    );
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
