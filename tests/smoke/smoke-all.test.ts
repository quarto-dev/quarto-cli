/*
 * smoke-all.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { expandGlobSync } from "fs/mod.ts";
import { testQuartoCmd } from "../test.ts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../src/core/lib/yaml-validation/state.ts";

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { parse } from "encoding/yaml.ts";
import { cleanoutput } from "./render/render.ts";
import { noErrorsOrWarnings } from "../verify.ts";

async function fullInit() {
  await initYamlIntelligenceResourcesFromFilesystem();
}

async function guessFormat(fileName: string): Promise<string[]> {
  const { cells } = await breakQuartoMd(Deno.readTextFileSync(fileName));

  const formats: Set<string> = new Set();

  for (const cell of cells) {
    if (cell.cell_type === "raw") {
      const src = cell.source.value.replaceAll(/^---$/mg, "");
      const yaml = parse(src);
      if (yaml && typeof yaml === "object") {
        const format = (yaml as Record<string, any>).format;
        if (typeof format === "object") {
          for (
            const [k, _] of Object.entries(
              // deno-lint-ignore no-explicit-any
              (yaml as Record<string, any>).format || {},
            )
          ) {
            formats.add(k);
          }
        } else if (typeof format === "string") {
          formats.add(format);
        }
      }
    }
  }
  return Array.from(formats);
}

for (
  const { path: fileName } of expandGlobSync(
    "docs/smoke-all/**/*.qmd",
  )
) {
  const input = fileName;

  const formats = await guessFormat(input);

  if (formats.length == 0) {
    formats.push("html");
  }

  for (const format of formats) {
    testQuartoCmd("render", [input, "--to", format], [noErrorsOrWarnings], {
      prereq: async () => {
        setInitializer(fullInit);
        await initState();
        return Promise.resolve(true);
      },
      teardown: () => {
        cleanoutput(input, format);
        return Promise.resolve();
      },
    });
  }
}
