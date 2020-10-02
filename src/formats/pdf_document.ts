import type { FormatDefinition, FormatOptions } from "../api/format.ts";
import { standardDocOptions } from "./common/options.ts";

export const pdfDocument: FormatDefinition = {
  name: "pdf_document",

  options: [
    ...standardDocOptions(),
  ],

  create: (options: FormatOptions) => {
    // unroll options
    const toc = options.toc as boolean;
    const fig_width = options.fig_width as number;
    const fig_height = options.fig_height as number;

    // build pandoc args
    const args: string[] = [];

    // table of contents
    if (toc) {
      args.push("--toc");
    }

    return {
      preprocessor: {
        fig_width,
        fig_height,
      },

      pandoc: {
        to: "latex",
        ext: "pdf",
        args,
      },
    };
  },
};
