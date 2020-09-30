import type { ComputationPreprocessor } from "../../../api/computation.ts";
import { execProcess } from "../../../core/process.ts";

export const ipynbPreprocessor: ComputationPreprocessor = {
  name: "ipynb",

  canHandle: (ext: string) => {
    return [".ipynb"].includes(ext.toLowerCase());
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
