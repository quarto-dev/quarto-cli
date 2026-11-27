/*
 * exec-process-reader-gone.test.ts
 *
 * execProcess with respectStreams (`quarto run`) forwards the child's output
 * to Quarto's own stdout. When the reader of that stdout goes away
 * (`quarto run script | head -n 1`), the child must be stopped and Quarto
 * must end quietly, rather than keep accumulating the output of a child that
 * keeps writing.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { execPath, killProcess, spawn } from "../../src/deno_ral/process.ts";
import { dirname, fromFileUrl, join } from "../../src/deno_ral/path.ts";
import { createTempContext } from "../../src/core/temp.ts";

const repoRoot = join(dirname(fromFileUrl(import.meta.url)), "..", "..");
const moduleUrl = (rel: string) =>
  new URL(`../../src/${rel}`, import.meta.url).href;
// The runner's exit code when execProcess reports the child as failed; the
// stopped child's own code differs by platform (1 on Windows, SIGTERM on POSIX).
const kChildStopped = 9;

unitTest(
  "execProcess - respectStreams stops the child when the reader goes away",
  async () => {
    const temp = createTempContext();
    try {
      // Writes until its own reader is gone.
      const writer = temp.createFileFromString(
        `import * as p from ${JSON.stringify(moduleUrl("deno_ral/process.ts"))};
const chunk = new Uint8Array(4096).fill(120);
while (p.writeStdoutSync(chunk) === chunk.length) {}
`,
        { suffix: ".ts" },
      );
      // Stands in for `quarto run writer.ts`.
      const runner = temp.createFileFromString(
        `import { execProcess } from ${JSON.stringify(moduleUrl("core/process.ts"))};
import * as p from ${JSON.stringify(moduleUrl("deno_ral/process.ts"))};
const r = await execProcess(
  { cmd: p.execPath(), args: ["run", "--no-config", "--allow-all", ${JSON.stringify(writer)}] },
  undefined, undefined, undefined, true,
);
p.exit(r.success ? 0 : ${kChildStopped});
`,
        { suffix: ".ts" },
      );
      const child = spawn(execPath(), {
        args: [
          "run",
          "--no-lock",
          "--allow-all",
          "--no-check",
          `--importmap=${join(repoRoot, "src", "import_map.json")}`,
          runner,
        ],
        stdin: "null",
        stdout: "piped",
        stderr: "piped",
      });
      const stderr = new Response(child.stderr!).text();
      const reader = child.stdout!.getReader();
      const first = await reader.read();
      assert(!first.done && first.value.length > 0, "no output from runner");
      await reader.cancel(); // like `head -n 1`

      let timer: ReturnType<typeof setTimeout> | undefined;
      let code: number | undefined;
      const ended = await Promise.race([
        child.status.then((s) => {
          code = s.code;
          return true;
        }),
        new Promise<boolean>((r) => {
          timer = setTimeout(() => r(false), 20_000);
        }),
      ]);
      clearTimeout(timer);
      if (!ended) {
        // The writer stops on its own once the runner's end of its pipe closes.
        killProcess(child.pid, "SIGKILL");
        await child.status;
      }
      const err = await stderr;
      assert(ended, `runner still running 20s after its reader went away\n${err}`);
      // Without the stop, a fast writer's output piles up until the runner
      // fails with "Invalid string length"; a slow one grows it indefinitely.
      assert(!/error/i.test(err), `runner did not end quietly:\n${err}`);
      assertEquals(code, kChildStopped, "the stopped child's failure reaches the caller");
    } finally {
      temp.cleanup();
    }
  },
);
