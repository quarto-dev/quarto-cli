/*
 * editor-support.test.ts
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { docs } from "../../utils.ts";
import { test } from "../../test.ts";
import { assertEquals } from "testing/asserts.ts";

test({
  name: "editor-support:crossref",
  context: {},
  execute: async () => {
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
      Deno.readTextFileSync(docs("crossrefs/sections.qmd")),
    );
    await writer.write(buf);
    await writer.close();
    const outputBuf = await child.output();
    const output = new TextDecoder().decode(outputBuf.stdout);
    const json = JSON.parse(output);
    assertEquals(json.entries[0].key, "sec-introduction");
    assertEquals(json.entries[0].caption, "Introduction");
  },
  verify: [],
  type: "smoke",
});
