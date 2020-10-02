import type { FormatDefinition, FormatOptions } from "../api/format.ts";
import { standardDocOptions } from "./common/options.ts";

export const htmlDocument: FormatDefinition = {
  name: "html_document",

  options: [
    ...standardDocOptions(),
    {
      name: "self_contained",
      description:
        "Produce a standalone HTML file with no external dependencies",
      default: false,
    },
  ],

  create: (options: FormatOptions) => {
    // unroll options
    const toc = options.toc as boolean;
    const self_contained = options.self_contained as boolean;
    const fig_width = options.fig_width as number;
    const fig_height = options.fig_height as number;

    // build pandoc args
    const args: string[] = ["--standalone"];

    // table of contents
    if (toc) {
      args.push("--toc");
    }

    // self-contianed
    if (self_contained) {
      args.push("--self-contained");
    }

    return {
      preprocessor: {
        fig_width,
        fig_height,
      },

      pandoc: {
        to: "html5",
        args,
      },
    };
  },
};
