import type { FormatOptions } from "../api/format.ts";

import type { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { ipynbEngine } from "./ipynb.ts";
import type { PandocIncludes } from "../core/pandoc.ts";

export interface ComputationEngineResult {
  supporting: string[];
  includes: PandocIncludes;
}

export interface ComputationEngine {
  name: string;
  canHandle: (ext: string) => boolean;
  metadata: (file: string) => Promise<Metadata>;
  process: (
    file: string,
    format: FormatOptions,
    output: string,
    quiet?: boolean,
  ) => Promise<ComputationEngineResult>;
}

export function computationEngineForFile(ext: string) {
  const engines = [
    rmdEngine,
    ipynbEngine,
  ];

  for (const engine of engines) {
    if (engine.canHandle(ext)) {
      return engine;
    }
  }

  return null;
}
