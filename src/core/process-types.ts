/*
 * process-types.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

export interface ProcessResult {
  success: boolean;
  code: number;
  stdout?: string;
  stderr?: string;
}
