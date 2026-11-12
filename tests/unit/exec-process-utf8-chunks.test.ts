/*
 * exec-process-utf8-chunks.test.ts
 *
 * Regression test for #15341: execProcess must keep a multi-byte UTF-8
 * character whole when the subprocess output splits it across two read
 * chunks. The child writes a long run of 3-byte characters, so read
 * boundaries (64 KiB is not a multiple of 3) fall inside a character.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "../asserts.ts";
import { execProcess } from "../../src/core/process.ts";
import { execPath } from "../../src/deno_ral/process.ts";

const kChar = "“";
const kCount = 100_000;
const expected = kChar.repeat(kCount);

// Child-side helpers: write all bytes to an fd, and sleep between writes.
const prelude = `import { writeSync } from "node:fs";
const w = (fd, b) => { let o = 0; while (o < b.length) o += writeSync(fd, b, o); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
`;

const childCmd = (script: string) => ({
  cmd: execPath(),
  args: ["eval", prelude + script],
  stdout: "piped" as const,
  stderr: "piped" as const,
});

const largeCmd = (fd: 1 | 2) =>
  childCmd(`w(${fd}, new TextEncoder().encode("${kChar}".repeat(${kCount})));`);

// 3 rounds: stdout [E2]; stderr "”"; stdout [80 9C]. Each stdout character
// is split across two writes with the other stream's output in between.
const interleavedCmd = childCmd(`for (let i = 0; i < 3; i++) {
  w(1, Uint8Array.of(0xE2));
  await sleep(100);
  w(2, new TextEncoder().encode("”"));
  await sleep(100);
  w(1, Uint8Array.of(0x80, 0x9C));
  await sleep(100);
}`);

const partialStderrCmd = childCmd(`w(2, Uint8Array.of(0xE2, 0x80));`);

const truncatedCmd = childCmd(`w(1, Uint8Array.of(0x61, 0xE2, 0x80));`);

unitTest("execProcess - stdout keeps characters split across chunks", async () => {
  const result = await execProcess(largeCmd(1));
  assertEquals(result.stdout, expected);
});

unitTest("execProcess - stderr keeps characters split across chunks", async () => {
  const result = await execProcess(largeCmd(2));
  assertEquals(result.stderr, expected);
});

unitTest(
  "execProcess - filtered stderr keeps characters split across chunks",
  async () => {
    const result = await execProcess(
      largeCmd(2),
      undefined,
      undefined,
      (output) => output,
    );
    assertEquals(result.stderr, expected);
  },
);

unitTest(
  "execProcess - merged output keeps characters split across chunks",
  async () => {
    const result = await execProcess(
      largeCmd(2),
      undefined,
      "stderr>stdout",
      (output) => output,
    );
    assertEquals(result.stdout, expected);
  },
);

unitTest(
  "execProcess - merged output interleaving streams keeps characters whole",
  async () => {
    const result = await execProcess(interleavedCmd, undefined, "stderr>stdout");
    // Mux order across sources is not a contract, so compare sorted characters.
    assertEquals([...result.stdout!].sort().join(""), "“““”””");
  },
);

unitTest("execProcess - filter never sees empty text", async () => {
  const seen: string[] = [];
  const result = await execProcess(
    partialStderrCmd,
    undefined,
    undefined,
    (s) => {
      seen.push(s);
      return s;
    },
  );
  assertEquals(seen, ["�"]);
  assertEquals(result.stderr, "�");
});

unitTest("execProcess - truncated tail decodes to one U+FFFD", async () => {
  const result = await execProcess(truncatedCmd);
  assertEquals(result.stdout, "a�");
});
