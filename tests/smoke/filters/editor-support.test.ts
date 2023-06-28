/*
 * editor-support.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts.ts";

async function runEditorSupportCrossref(doc: string) {
  let cmdLine: string;
  switch (Deno.build.os) {
    case "windows":
      cmdLine = "../package/dist/bin/quarto.cmd";
      break;
    default:
      cmdLine = "../package/dist/bin/quarto";
      break;
  }
  const cmd = new Deno.Command(cmdLine, {
    args: ["editor-support", "crossref"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const writer = child.stdin.getWriter();
  const buf = new TextEncoder().encode(
    Deno.readTextFileSync(doc),
  );
  await writer.write(buf);
  await writer.close();
  const outputBuf = await child.output();
  const status = await child.status;
  assertEquals(status.code, 0);
  const output = new TextDecoder().decode(outputBuf.stdout);
  const json = JSON.parse(output);
  return json;
}

test({
  name: "editor-support:crossref:smoke-1",
  context: {},
  execute: async () => {
    const json = await runEditorSupportCrossref(docs("crossrefs/sections.qmd"));
    assertEquals(json.entries[0].key, "sec-introduction");
    assertEquals(json.entries[0].caption, "Introduction");
  },
  verify: [],
  type: "smoke",
});

test({
  name: "editor-support:crossref:smoke-2",
  context: {},
  execute: async () => {
    await runEditorSupportCrossref(
      docs("crossrefs/unnumbered-crossrefs.qmd"),
    );
  },
  verify: [],
  type: "smoke",
});
