/*
* yaml.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";

import { parse } from "encoding/yaml.ts";

const kRegExYAML =
  /(^)(---[ \t]*[\r\n]+(?![ \t]*[\r\n]+)[\W\w]*?[\r\n]+(?:---|\.\.\.))([ \t]*)$/gm;

const kRegxHTMLComment = /<!--[\W\w]*?-->/gm;
const kRegexFencedCode = /^([\t >]*`{3,})[^`\n]*\n[\W\w]*?\n\1\s*$/gm;

export function readYaml(file: string) {
  if (existsSync(file)) {
    const decoder = new TextDecoder("utf-8");
    const yml = Deno.readFileSync(file);
    return parse(decoder.decode(yml));
  } else {
    throw new Error(`YAML file ${file} not found.`);
  }
}

export function readYamlFromString(yml: string) {
  return parse(yml);
}

export function readYamlFromMarkdown(
  markdown: string,
): { [key: string]: unknown } {
  if (markdown) {
    // remove html comments and fenced code regions
    markdown = markdown.replaceAll(kRegxHTMLComment, "");
    markdown = markdown.replaceAll(kRegexFencedCode, "");

    // capture all yaml blocks as a single yaml doc
    let yaml = "";
    kRegExYAML.lastIndex = 0;
    let match = kRegExYAML.exec(markdown);
    while (match != null) {
      yaml += removeYamlDelimiters(match[2]);
      match = kRegExYAML.exec(markdown);
    }
    kRegExYAML.lastIndex = 0;

    // parse the yaml
    const metadata = parse(yaml, { json: true });
    return (metadata || {}) as { [key: string]: unknown };
  } else {
    return {};
  }
}

export function readYamlFromMarkdownFile(
  file: string,
): { [key: string]: unknown } {
  const markdown = Deno.readTextFileSync(file);
  return readYamlFromMarkdown(markdown);
}

export function readYamlFrontMatterFromMarkdownFile(
  file: string,
) {
  const markdown = Deno.readTextFileSync(file);
  const result = partitionYamlFrontMatter(markdown);
  if (result) {
    return readYamlFromMarkdown(result.yaml);
  } else {
    return null;
  }
}

export function partitionYamlFrontMatter(
  markdown: string,
): { yaml: string; markdown: string } | null {
  kRegExYAML.lastIndex = 0;
  const match = kRegExYAML.exec(markdown);
  kRegExYAML.lastIndex = 0;
  if (match) {
    const yaml = match[2];
    const yamlPos = markdown.indexOf(yaml);

    const md = (yamlPos > 0 ? markdown.slice(0, yamlPos) : "") +
      markdown.slice(yamlPos + yaml.length);
    return { yaml: removeYamlDelimiters(yaml), markdown: md };
  } else {
    return null;
  }
}

function removeYamlDelimiters(yaml: string) {
  return yaml
    .replace(/^---/, "")
    .replace(/---\s*$/, "");
}
