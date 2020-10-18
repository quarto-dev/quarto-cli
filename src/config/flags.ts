import { kSelfContained } from "./constants.ts";

export const kStdOut = "-";

// pandoc command line flags that we need to inspect
export interface PandocFlags {
  // pandoc flags
  to?: string;
  output?: string;
  [kSelfContained]?: boolean;
  pdfEngine?: string;
  pdfEngineOpts?: string[];
  natbib?: boolean;
  biblatex?: boolean;
}
