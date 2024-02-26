/*
 * types.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { ProcessResult } from "../../core/process-types.ts";

export interface RunHandlerOptions {
  cwd?: string;
  env?: {
    [key: string]: string;
  };
  stdout?: "inherit" | "piped" | "null";
}

export interface RunHandler {
  canHandle: (script: string) => boolean;
  run: (
    script: string,
    args: string[],
    stdin?: string,
    options?: RunHandlerOptions,
  ) => Promise<ProcessResult>;
}
