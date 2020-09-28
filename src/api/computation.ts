export interface ComputationPreprocessor {
  name: string;
  canHandle: (file: string) => boolean;
  preprocess: (file: string, outputFile: string) => void;
}

/*
export interface ComputationSource {

}
*/
