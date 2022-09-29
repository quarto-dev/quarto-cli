/*
 * smoke-all.test.ts
 *
 * Copyright (C) 2022 by RStudio, PBC
 *
 */

import { expandGlobSync } from "fs/mod.ts";
import { unitTest } from "../test.ts";

import { initYamlIntelligenceResourcesFromFilesystem } from "../../src/core/schema/utils.ts";
import {
  initState,
  setInitializer,
} from "../../src/core/lib/yaml-validation/state.ts";

import { breakQuartoMd } from "../../src/core/lib/break-quarto-md.ts";
import { parse } from "encoding/yaml.ts";
import { cleanoutput } from "./render/render.ts";
import { quarto } from "../../src/quarto.ts";

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
        for (
          const [k, _] of Object.entries(
            // deno-lint-ignore no-explicit-any
            (yaml as Record<string, any>).format || {},
          )
        ) {
          formats.add(k);
        }
      }
    }
  }
  return Array.from(formats);
}

unitTest("smoke-all", async () => {
  setInitializer(fullInit);
  await initState();

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
      await quarto(["render", input, "--to", format]);
      console.log(`Rendered ${input} to ${format}`);
      cleanoutput(input, format);
    }
  }
});
