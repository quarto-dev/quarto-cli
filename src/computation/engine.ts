import type { FormatOptions } from "../api/format.ts";

import type { Metadata } from "../core/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { ipynbEngine } from "./ipynb.ts";

export interface ComputationEngineResult {
  supporting?: string[];
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
