/*
 * notarize-status.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 *
 */

export interface NotarizationResult {
  id?: string;
  status?: string;
}

// Parses the stdout of `xcrun notarytool submit --wait`.
//
// The output carries several `id:` lines (Submission ID, uploaded-file id,
// processing-complete id) and a terminal `status:` line inside the final
// "Processing complete" block. We take the first `id:` (the submission id,
// which is what `xcrun notarytool log <id>` expects) and the terminal
// `status:` (Accepted / Invalid / Rejected).
export function parseNotarizationResult(stdout: string): NotarizationResult {
  // First `id:` line is the submission id (also what `notarytool log` wants).
  const idMatch = stdout.match(/^\s*id:\s*(\S+)/m);
  // Terminal `status:` line lives in the final "Processing complete" block.
  // (`Current status:` lines are streamed progress, not the verdict, and don't
  // match this anchored `status:` prefix.) Take the last one to be safe.
  const statusMatches = [...stdout.matchAll(/^\s*status:\s*(\S+)/gm)];
  const lastStatus = statusMatches.at(-1);
  return {
    id: idMatch?.[1],
    status: lastStatus?.[1],
  };
}
