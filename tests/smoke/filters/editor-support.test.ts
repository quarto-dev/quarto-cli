/*
 * editor-support.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { quartoDevBinCmd, quartoSpawnEnvOptions } from "../../quarto-cmd.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts";

async function runEditorSupportCrossref(doc: string) {
  // pinned to the locally-built dev CLI (not PATH quarto) as before the
  // binary-mode migration; resolves to QUARTO_TEST_BIN in binary mode
  const cmd = new Deno.Command(quartoDevBinCmd(), {
    args: ["editor-support", "crossref"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    ...quartoSpawnEnvOptions(),
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  const buf = new TextEncoder().encode(
    Deno.readTextFileSync(doc),
  );
  await writer.write(buf);
  // close() flushes the write and closes the stream (sends EOF to the child);
  // it does not release the writer's lock, but nothing reuses the stream so
  // the held lock is inert and leaks no resource. Do NOT releaseLock() first —
  // that detaches the writer and makes close() throw "A writable stream is not
  // associated with the writer".
  await writer.close();
  const outputBuf = await child.output();
  const status = await child.status;
  assertEquals(status.code, 0);
  const output = new TextDecoder().decode(outputBuf.stdout);
  const json = JSON.parse(output);
  return json;
}

// The harness swallows errors thrown from execute() (they become log
// records nothing here reads), so the spawn + assertions must live in a
// verifier for these tests to be able to fail at all.
test({
  name: "editor-support:crossref:smoke-1",
  context: {},
  execute: async () => {},
  verify: [{
    name: "editor-support crossref output",
    verify: async (_outputs) => {
      const json = await runEditorSupportCrossref(
        docs("crossrefs/sections.qmd"),
      );
      assertEquals(json.entries[0].key, "sec-introduction");
      assertEquals(json.entries[0].caption, "Introduction");
    },
  }],
  type: "smoke",
});

function smokeTestCrossref(name: string, doc: string) {
  test({
    name,
    context: {},
    execute: async () => {},
    verify: [{
      name: "editor-support crossref runs cleanly",
      verify: async (_outputs) => {
        await runEditorSupportCrossref(doc);
      },
    }],
    type: "smoke",
  });
}

const smokeTestCrossrefDocs = [
  "crossrefs/editor-support/unnumbered-crossrefs.qmd",
  "crossrefs/editor-support/all.qmd",
  "crossrefs/editor-support/crossref-with-raw-latex.qmd",
];
for (const doc of smokeTestCrossrefDocs) {
  smokeTestCrossref(
    `editor-support:crossref:smoke-${doc}`,
    docs(doc),
  );
}
