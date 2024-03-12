/*
 * build-schema-file.ts
 *
 * Collects the existing schemas and builds a single JSON file with
 * their description
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { resourcePath } from "../resources.ts";
import {
  getSchemaDefinitionsObject,
  setSchemaDefinition,
} from "../lib/yaml-validation/schema.ts";
import { ensureSchemaResources } from "./yaml-schema.ts";
import { revealPluginSchema } from "../../format/reveal/schemas.ts";
import { Element, initDenoDom, parseHtml } from "../deno-dom.ts";

import { pandocBinaryPath } from "../resources.ts";

import { execProcess } from "../process.ts";

import { walkSchema } from "../lib/yaml-validation/schema-utils.ts";

import { Schema, SchemaDocumentation } from "../lib/yaml-schema/types.ts";
import {
  exportYamlIntelligenceResources,
  setYamlIntelligenceResources,
} from "../lib/yaml-intelligence/resources.ts";
import { getFormatAliases } from "../lib/yaml-schema/format-aliases.ts";
import { getFrontMatterSchema } from "../lib/yaml-schema/front-matter.ts";
import { getProjectConfigSchema } from "../lib/yaml-schema/project-config.ts";
import { getEngineOptionsSchema } from "../lib/yaml-schema/chunk-metadata.ts";
import { languages, languageSchema } from "../handlers/base.ts";
import { idSchema } from "../lib/yaml-schema/common.ts";
import { kLangCommentChars } from "../lib/partition-cell-options.ts";
import { generateTypesFromSchemas } from "./types-from-schema.ts";
import { InternalError } from "../lib/error.ts";

////////////////////////////////////////////////////////////////////////////////

export async function buildIntelligenceResources() {
  await ensureSchemaResources();

  // call all of these to add them to the definitions list so we can
  // get the markdown translations and record them.
  getFormatAliases();
  await getFrontMatterSchema();
  await getProjectConfigSchema();
  await getEngineOptionsSchema();

  // in addition, we do have to record the (right now, only)
  // plugin schema that exists
  //
  // FIXME there should be a plugin registration api or something
  const externalSchemas = [revealPluginSchema];
  for (const schema of externalSchemas) {
    setSchemaDefinition(schema);
  }

  // finally, we need to record the html descriptions from pandoc
  // so we can patch them if requested.
  const htmlDescriptions = await createHtmlDescriptions();

  setYamlIntelligenceResources({
    "schema/html-descriptions.yml": htmlDescriptions,
    "schema/external-schemas.yml": externalSchemas,
    "handlers/languages.yml": languages(),
    "handlers/lang-comment-chars.yml": kLangCommentChars,
  });

  for (const language of languages()) {
    let schema = await languageSchema(language);
    if (schema) {
      schema = idSchema(schema, `handlers/${language}`);
      setYamlIntelligenceResources({
        [`handlers/${language}/schema.yml`]: schema,
      });
    }
  }

  const yamlResources = exportYamlIntelligenceResources(true);
  const yamlResourcesPath = resourcePath(
    "/editor/tools/yaml/yaml-intelligence-resources.json",
  );
  Deno.writeTextFileSync(yamlResourcesPath, yamlResources);

  await generateTypesFromSchemas(resourcePath());
}

function getMarkdownDescriptions() {
  const result: string[] = [];

  const schemaList = Object.values(getSchemaDefinitionsObject());

  for (const schema of schemaList) {
    walkSchema(schema, (s: Schema) => {
      if (s === false || s === true) {
        return;
      }
      const description = s?.tags
        ?.description as (SchemaDocumentation | undefined);
      if (description === undefined) {
        return;
      }
      result.push(`## annotation\n`);
      if (typeof description === "string") {
        result.push(`### string\n`);
        result.push(description);
        result.push("");
      } else {
        result.push(`### short\n`);
        result.push(description?.short || "");
        result.push("");
        result.push(`### long\n`);
        result.push(description?.long || "");
        result.push("");
      }
      return;
    });
  }
  return result.join("\n");
}

async function createHtmlDescriptions(): Promise<
  (string | { short?: string; long?: string })[]
> {
  const markdownDescriptions = getMarkdownDescriptions();
  const descriptionList: (string | { short?: string; long?: string })[] = [];
  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = ["--to", "html"];

  const pandocResult = await execProcess(pandocBinaryPath(), {
    stdout: "piped",
    args: cmd,
  }, markdownDescriptions);

  if (!pandocResult.success) {
    throw new InternalError("Couldn't run pandoc");
  }

  await initDenoDom();

  const doc = await parseHtml(pandocResult.stdout!);

  for (const entryNode of doc.querySelectorAll("h2")) {
    const entry = entryNode as Element;
    const values: Record<string, string> = {};
    for (
      const value of filter(
        stopWhen(
          siblings(entry),
          (e) => e.tagName === "H2",
        ),
        (e) => e.tagName === "H3",
      )
    ) {
      const name = value.textContent;
      const html: string[] = [];
      for (
        const p of stopWhen(siblings(value), (e) => e.tagName !== "P")
      ) {
        html.push(p.innerHTML);
      }

      values[name] = html.join("\n");
    }

    if (values["string"]) {
      descriptionList.push(values["string"]);
    } else if (values["short"] || values["long"]) {
      descriptionList.push({
        short: values["short"],
        long: values["long"],
      });
    }
  }
  return descriptionList;
}

function* siblings(entry: Element): Generator<Element> {
  do {
    if (entry.nextElementSibling === null) {
      return;
    }
    entry = entry.nextElementSibling as Element;
    yield entry;
  } while (true);
}

function* stopWhen(
  gen: Generator<Element>,
  when: (v: Element) => boolean,
): Generator<Element> {
  for (const v of gen) {
    if (when(v)) {
      break;
    }
    yield v;
  }
}

function* filter<T>(gen: Generator<T>, f: (v: T) => boolean): Generator<T> {
  for (const v of gen) {
    if (f(v)) {
      yield v;
    }
  }
}
