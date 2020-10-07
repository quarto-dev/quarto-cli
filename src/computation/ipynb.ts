import type { Metadata } from "../core/metadata.ts";
import { execProcess } from "../core/process.ts";
import type { ComputationEngine } from "./engine.ts";
import { resourcePath } from "../core/resources.ts";
import { metadataFromMarkdown } from "../core/metadata.ts";
import type { FormatOptions } from "../api/format.ts";

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

  process: async (
    file: string,
    format: FormatOptions,
    output: string,
  ): Promise<void> => {
    const result = await execProcess({
      cmd: [
        Deno.env.get("CONDA_PREFIX")! + "/bin/python",
        resourcePath("ipynb.py"),
        file,
        output,
      ],
    });

    if (result.success) {
      //
    } else {
      return Promise.reject();
    }
  },
};
