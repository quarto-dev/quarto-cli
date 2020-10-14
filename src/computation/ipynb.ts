import type { Format } from "../api/format.ts";

import type { Metadata } from "../config/metadata.ts";
import { metadataFromMarkdown } from "../config/metadata.ts";

import { execProcess } from "../core/process.ts";
import { resourcePath } from "../core/resources.ts";

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
    file: string,
    format: Format,
    output: string,
    quiet?: boolean,
  ): Promise<ExecuteResult> => {
    const condaPrefix = Deno.env.get("CONDA_PREFIX");
    if (!condaPrefix) {
      throw new Error("CONDA_PREFIX not defined");
    }
    const result = await execProcess({
      cmd: [
        condaPrefix + "/bin/python",
        resourcePath("ipynb.py"),
        file,
        output,
      ],
    });

    if (result.success) {
      return {
        supporting: [],
        includes: {},
        preserved: {},
      };
    } else {
      return Promise.reject();
    }
  },

  postProcess: (
    format: Format,
    output: string,
    preserved: { [key: string]: string },
    quiet?: boolean,
  ) => {
    return Promise.resolve(output);
  },
};
