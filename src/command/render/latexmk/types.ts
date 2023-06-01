/*
 * types.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { PdfEngine } from "../../../config/types.ts";

export const kLatexBodyMessageOptions = { indent: 2 };

// latexmk options
export interface LatexmkOptions {
  input: string;
  engine: PdfEngine;
  autoInstall?: boolean;
  autoMk?: boolean;
  minRuns?: number;
  maxRuns?: number;
  outputDir?: string;
  texInputDirs?: string[];
  tinyTex?: boolean;
  clean?: boolean;
  quiet?: boolean;
}
