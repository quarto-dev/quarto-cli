import type { Format } from "../api/format.ts";

import { getenv } from "../core/env.ts";
import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

import type { Metadata } from "../config/metadata.ts";
import { metadataFromMarkdown } from "../config/metadata.ts";

import type { ComputationEngine, ExecuteResult } from "./engine.ts";

export const ipynbEngine: ComputationEngine = {
  name: "ipynb",

  canHandle: (ext: string) => {
    return [".ipynb"].includes(ext.toLowerCase());
  },

  metadata: async (file: string): Promise<Metadata> => {
    const decoder = new TextDecoder("utf-8");
    const ipynbContents = await Deno.readFile(file);
    const ipynb = JSON.parse(decoder.decode(ipynbContents));
    const cells = ipynb.cells as Array<{ cell_type: string; source: string[] }>;
    const markdown = cells.reduce((md, cell) => {
      if (cell.cell_type === "markdown") {
        return md + "\n" + cell.source.join("");
      } else {
        return md;
      }
    }, "");

    return metadataFromMarkdown(markdown);
  },

  execute: async (
    input: string,
    format: Format,
    output: string,
    quiet?: boolean,
  ): Promise<ExecuteResult> => {
    const condaPrefix = getenv("CONDA_PREFIX");
    const result = await execProcess({
      cmd: [
        condaPrefix + "/bin/python",
        resourcePath("ipynb.py"),
        input,
        output,
      ],
    });

    if (result.success) {
      return {
        supporting: [],
        includes: {},
      };
    } else {
      return Promise.reject();
    }
  },

  postprocess: (
    format: Format,
    output: string,
    data: unknown,
    quiet?: boolean,
  ) => {
    return Promise.resolve(output);
  },
};
