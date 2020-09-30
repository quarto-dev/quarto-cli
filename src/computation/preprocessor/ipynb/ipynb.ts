import type { Metadata } from "../../../core/metadata.ts";
import { execProcess } from "../../../core/process.ts";
import type { ComputationPreprocessor } from "../preprocessor.ts";

export const ipynbPreprocessor: ComputationPreprocessor = {
  name: "ipynb",

  canHandle: (ext: string) => {
    return [".ipynb"].includes(ext.toLowerCase());
  },

  metadata: async (file: string): Promise<Metadata> => {
    return {};
  },

  preprocess: async (file: string, outputFile: string): Promise<void> => {
    const result = await execProcess({
      cmd: [
        Deno.env.get("CONDA_PREFIX")! + "/bin/python",
        "../src/computation/preprocessor/ipynb/ipynb.py",
        file,
        outputFile,
      ],
    });

    if (!result.success) {
      return Promise.reject();
    }
  },
};
