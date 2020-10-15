import { extname } from "path/mod.ts";

import type { Format } from "../api/format.ts";

import type { Metadata } from "../config/metadata.ts";

import { rmdEngine } from "./rmd.ts";
import { ipynbEngine } from "./ipynb.ts";
import type { PandocIncludes } from "../core/pandoc.ts";

export interface ExecuteOptions {
  input: string;
  output: string;
  format: Format;
  cwd?: string;
  params?: string | { [key: string]: unknown };
  quiet?: boolean;
}

export interface PostProcessOptions {
  input: string;
  format: Format;
  output: string;
  data: unknown;
  quiet?: boolean;
}

export interface ExecuteResult {
  supporting: string[];
  includes: PandocIncludes;
  postprocess?: unknown;
}

export interface ComputationEngine {
  name: string;
  canHandle: (ext: string) => boolean;
  metadata: (file: string) => Promise<Metadata>;
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;
  postprocess: (options: PostProcessOptions) => Promise<string>;
}

export function computationEngineForFile(file: string) {
  const engines = [
    rmdEngine,
    ipynbEngine,
  ];

  const ext = extname(file);
  for (const engine of engines) {
    if (engine.canHandle(ext)) {
      return engine;
    }
  }

  return null;
}
