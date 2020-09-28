export interface ComputationPreprocessor {
  name: string;
  canHandle: (ext: string) => boolean;
  preprocess: (file: string, outputFile: string) => Promise<void>;
}
