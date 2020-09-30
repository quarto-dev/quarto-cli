import type { Metadata } from "../../core/metadata.ts";

export interface ComputationPreprocessor {
  name: string;
  canHandle: (ext: string) => boolean;
  metadata: (file: string) => Promise<Metadata>;
  preprocess: (file: string, outputFile: string) => Promise<void>;
}
