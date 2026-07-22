/*
 * macos-notarize-status.test.ts
 *
 * Tests the parser that extracts the submission id and terminal status from
 * `xcrun notarytool submit --wait` output. macOS release builds gate stapling
 * (and, since PR #14718, whether the release proceeds at all) on the notary
 * service returning `status: Accepted` -- a check the build previously skipped,
 * trusting only the process exit code.
 *
 * Inputs are hand-written samples of notarytool's own output (the contract
 * Apple hands us), so a change to Quarto's own build logic is what these guard,
 * not Apple's service.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import { parseNotarizationResult } from "../../package/src/macos/notarize-status.ts";

const acceptedOutput = `Conducting pre-submission checks for quarto-1.10.17-macos.pkg and initiating connection to the Apple notary service...
Submission ID received
  id: 2efe2717-52ef-43a5-96dc-0797e4ca1041
Successfully uploaded file
  id: 2efe2717-52ef-43a5-96dc-0797e4ca1041
  path: /Users/runner/work/quarto-cli/quarto-1.10.17-macos.pkg
Waiting for processing to complete.
Current status: Accepted..........
Processing complete
  id: 2efe2717-52ef-43a5-96dc-0797e4ca1041
  status: Accepted
`;

const invalidOutput = `Conducting pre-submission checks for quarto-1.10.17-macos.pkg and initiating connection to the Apple notary service...
Submission ID received
  id: 9a9b9c9d-1111-2222-3333-444455556666
Successfully uploaded file
  id: 9a9b9c9d-1111-2222-3333-444455556666
  path: /Users/runner/work/quarto-cli/quarto-1.10.17-macos.pkg
Waiting for processing to complete.
Current status: Invalid..........
Processing complete
  id: 9a9b9c9d-1111-2222-3333-444455556666
  status: Invalid
`;

unitTest("parseNotarizationResult - accepted submission", async () => {
  const result = parseNotarizationResult(acceptedOutput);
  assertEquals(result.id, "2efe2717-52ef-43a5-96dc-0797e4ca1041");
  assertEquals(result.status, "Accepted");
});

unitTest("parseNotarizationResult - invalid submission", async () => {
  const result = parseNotarizationResult(invalidOutput);
  assertEquals(result.id, "9a9b9c9d-1111-2222-3333-444455556666");
  assertEquals(result.status, "Invalid");
});

unitTest("parseNotarizationResult - no id or status when absent", async () => {
  const result = parseNotarizationResult("some unrelated output\n");
  assertEquals(result.id, undefined);
  assertEquals(result.status, undefined);
});
