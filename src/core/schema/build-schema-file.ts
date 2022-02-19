/*
* build-schema-file.ts
*
* Collects the existing schemas and builds a single JSON file with
* their description
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { getFrontMatterSchema } from "./front-matter.ts";
import { getProjectConfigSchema } from "./project-config.ts";
import { getEngineOptionsSchema } from "./chunk-metadata.ts";
import { resourcePath } from "../resources.ts";
import { getSchemas } from "../lib/yaml-validation/schema-utils.ts";
import {
  getSchemaDefinitionsObject,
  setSchemaDefinition,
} from "../lib/yaml-validation/schema.ts";
import { getFormatAliases } from "./format-aliases.ts";
import { ensureAjv } from "./yaml-schema.ts";
import { revealPluginSchema } from "../../format/reveal/format-reveal-plugin.ts";
import { DOMParser, Element, initDenoDom } from "../deno-dom.ts";

import { pandocBinaryPath } from "../resources.ts";

import { execProcess } from "../process.ts";

import { walkSchema } from "../lib/yaml-validation/schema-utils.ts";

import { Schema, SchemaDocumentation } from "../lib/yaml-validation/types.ts";

////////////////////////////////////////////////////////////////////////////////

export async function buildSchemaFile() {
  await ensureAjv();
  const obj = getSchemas();
  obj.aliases = getFormatAliases();
  obj.schemas["front-matter"] = await getFrontMatterSchema();
  obj.schemas.config = await getProjectConfigSchema();
  obj.schemas.engines = await getEngineOptionsSchema();
  setSchemaDefinition(revealPluginSchema);
  await patchMarkdownDescriptions();
  obj.definitions = getSchemaDefinitionsObject();
  const str = JSON.stringify(obj);
  const path = resourcePath("/editor/tools/yaml/quarto-json-schemas.json");
  return Deno.writeTextFile(path, str);
}

async function patchMarkdownDescriptions() {
  const result: string[] = [];

  const schemaList = Object.values(getSchemaDefinitionsObject());
  const descriptionList: (string | { short?: string; long?: string })[] = [];

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
  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [pandocBinaryPath(), "--to", "html"];

  const pandocResult = await execProcess(
    { stdout: "piped", cmd },
    result.join("\n"),
  );

  if (!pandocResult.success) {
    throw new Error("Internal error - couldn't run pandoc");
  }
  // console.log(pandocResult);

  await initDenoDom();

  const doc = new DOMParser().parseFromString(
    pandocResult.stdout!,
    "text/html",
  )!;

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

  let cursor = 0;

  for (const schema of schemaList) {
    walkSchema(schema, (s: Schema) => {
      if (s === false || s === true) {
        return;
      }
      const description = s?.tags?.description;
      if (!description) {
        return;
      }

      const fixedDescription = descriptionList[cursor++];
      // we directly mutate the schema here on purpose, so this will get stored
      // when the .json is saved.
      if (typeof fixedDescription === "string") {
        s.documentation = fixedDescription;
      } else if (typeof fixedDescription?.short === "string") {
        s.documentation = fixedDescription.short;
      }
    });
  }
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
