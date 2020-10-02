import type { FormatDefinition, FormatOptions } from "../api/format.ts";
import { standardDocOptions } from "./common/options.ts";

export const pdfDocument: FormatDefinition = {
  name: "pdf_document",

  options: [
    ...standardDocOptions({
      fig_width: 6.5,
      fig_height: 4.5,
    }),
  ],

  create: (options: FormatOptions) => {
    // unroll options
    const toc = options.toc as boolean;
    const fig_width = options.fig_width as number;
    const fig_height = options.fig_height as number;

    // build pandoc args
    const args: string[] = ["--self-contained"];

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

      clean_supporting: true,
    };
  },
};
