/*
 * process.test.ts
 *
 * Compatibility contract for src/deno_ral/process.ts: every implementation of
 * the module keeps this file green.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "../../asserts.ts";
import { isWindows } from "../../../src/deno_ral/platform.ts";
import {
  args,
  cwd,
  exec,
  execPath,
  execSync,
  isTerminal,
  killProcess,
  pid,
  spawn,
  writeStdoutSync,
} from "../../../src/deno_ral/process.ts";
import { basename, isAbsolute } from "../../../src/deno_ral/path.ts";
import { createTempContext } from "../../../src/core/temp.ts";

const kProcessModule =
  new URL("../../../src/deno_ral/process.ts", import.meta.url).href;

// A shell one-liner as [program, args] for the current platform.
function shell(script: string): [string, string[]] {
  return isWindows ? ["cmd", ["/c", script]] : ["sh", ["-c", script]];
}
const decode = (b: Uint8Array) => new TextDecoder().decode(b).trim();

// Write a child script that imports the layer, and the command line that runs
// it with the current runtime.
function childScript(
  body: string,
): { cmd: string; args: string[]; cleanup: () => void } {
  const temp = createTempContext();
  const file = temp.createFileFromString(
    `import * as p from ${JSON.stringify(kProcessModule)};\n${body}\n`,
    { suffix: ".ts" },
  );
  return {
    cmd: execPath(),
    args: ["run", "--no-config", "--allow-all", file],
    cleanup: () => temp.cleanup(),
  };
}

const kMiB = 1024 * 1024;
const kWriteMiBThenExit3 = `
const chunk = new Uint8Array(65536).fill(120);
for (let i = 0; i < 16; i++) p.writeStdoutSync(chunk);
p.exit(3);
`;

unitTest("process.exec - captures stdout and stderr, code 0", async () => {
  const [prog, a] = shell(
    isWindows ? "echo out & echo err 1>&2" : "echo out; echo err 1>&2",
  );
  const r = await exec(prog, { args: a });
  assertEquals(r.success, true);
  assertEquals(r.code, 0);
  assertEquals(r.signal, null);
  assertEquals(decode(r.stdout), "out");
  assertEquals(decode(r.stderr), "err");
});

unitTest("process.exec - non-zero exit code", async () => {
  const [prog, a] = shell("exit 3");
  const r = await exec(prog, { args: a });
  assertEquals(r.success, false);
  assertEquals(r.code, 3);
});

unitTest(
  "process.exec - missing executable rejects with cmd, ENOENT code and cause",
  async () => {
    const err = await assertRejects(
      () => exec("quarto-no-such-binary-7f3a", { args: ["--version"] }),
      Error,
    );
    assertStringIncludes(err.message, "quarto-no-such-binary-7f3a");
    assertEquals((err as Error & { code?: string }).code, "ENOENT");
    assert(err.cause !== undefined, "the runtime error is kept as cause");
  },
);

unitTest("process.exec - inherit gives empty buffers, not errors", async () => {
  const [prog, a] = shell("exit 0");
  const r = await exec(prog, { args: a, stdout: "inherit", stderr: "null" });
  assertEquals(r.stdout.length, 0);
  assertEquals(r.stderr.length, 0);
});

unitTest("process.execSync - mirrors exec", async () => {
  const [prog, a] = shell("echo sync");
  const r = execSync(prog, { args: a });
  assertEquals(r.code, 0);
  assertEquals(decode(r.stdout), "sync");
});

unitTest("process.exec - env is visible to the child", async () => {
  const [prog, a] = shell(
    isWindows ? "echo %QUARTO_RAL_TEST%" : "echo $QUARTO_RAL_TEST",
  );
  const r = await exec(prog, {
    args: a,
    env: { QUARTO_RAL_TEST: "hello-ral" },
  });
  assertEquals(decode(r.stdout), "hello-ral");
});

unitTest(
  "process.exec - env is merged over the inherited environment",
  async () => {
    const [prog, a] = shell(isWindows ? "echo %PATH%" : 'echo "$PATH"');
    const without = decode((await exec(prog, { args: a })).stdout);
    const withEnv = decode(
      (await exec(prog, { args: a, env: { QUARTO_RAL_TEST: "x" } })).stdout,
    );
    assert(without.length > 0, "PATH is set in the test environment");
    assertEquals(withEnv, without, "passing env keeps PATH");
  },
);

unitTest("process.exec - clearEnv removes inherited variables", async () => {
  if (isWindows) return; // cmd.exe needs SystemRoot; the semantics are tested on POSIX only
  const r = await exec("/bin/sh", {
    args: ["-c", 'echo "${HOME:-unset}"'],
    clearEnv: true,
  });
  assertEquals(decode(r.stdout), "unset");
});

unitTest("process.exec - cwd option", async () => {
  const temp = createTempContext();
  const dir = temp.createDir({ prefix: "ral-cwd-" });
  const [prog, a] = shell(isWindows ? "cd" : "pwd");
  const r = await exec(prog, { args: a, cwd: dir });
  assertEquals(basename(decode(r.stdout)), basename(dir));
  temp.cleanup();
});

unitTest("process.spawn - piped stdin is echoed to piped stdout", async () => {
  const [prog, a] = isWindows ? ["cmd", ["/c", "more"]] : ["cat", []];
  const child = spawn(prog, {
    args: a,
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
  });
  assert(child.pid > 0);
  assert(
    child.stdin !== null && child.stdout !== null && child.stderr === null,
  );
  const writer = child.stdin!.getWriter();
  await writer.write(new TextEncoder().encode("ping\n"));
  await writer.close();
  const out = decode(await new Response(child.stdout!).bytes());
  const status = await child.status;
  assertEquals(out, "ping");
  assertEquals(status.success, true);
});

unitTest(
  "process.spawn - kill ends the child with a failed status",
  async () => {
    const [prog, a] = isWindows
      ? ["ping", ["-n", "30", "127.0.0.1"]]
      : ["sleep", ["30"]];
    const child = spawn(prog, { args: a, stdout: "null", stderr: "null" });
    child.kill("SIGTERM");
    const status = await child.status;
    assertEquals(status.success, false);
    if (!isWindows) assertEquals(status.signal, "SIGTERM");
  },
);

unitTest(
  "process.spawn - detached child leads a group; killProcess(-pid) ends the grandchild",
  async () => {
    if (isWindows) return; // process groups are POSIX; Windows has no group to lead
    const child = spawn("sh", {
      args: ["-c", "sleep 30 & echo $!; wait"],
      stdout: "piped",
      stderr: "null",
      detached: true,
    });
    const reader = child.stdout!.pipeThrough(new TextDecoderStream())
      .getReader();
    let text = "";
    while (!text.includes("\n")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += value;
    }
    const grandchild = Number(text.trim());
    assert(grandchild > 0, `grandchild pid: ${text}`);
    killProcess(-child.pid, "SIGTERM");
    await child.status;
    await reader.cancel();
    // Gone means: no such process, or a zombie waiting to be reaped.
    let alive = true;
    for (let i = 0; i < 50 && alive; i++) {
      const ps = await exec("ps", {
        args: ["-o", "stat=", "-p", String(grandchild)],
      });
      const state = decode(ps.stdout);
      alive = ps.success && state.length > 0 && !state.startsWith("Z");
      if (alive) await new Promise((r) => setTimeout(r, 100));
    }
    assertEquals(
      alive,
      false,
      `grandchild ${grandchild} survived the group kill`,
    );
  },
);

unitTest("process - cwd, pid, args, execPath", async () => {
  assert(isAbsolute(cwd()));
  assert(pid() > 0);
  assert(execPath().length > 0);
  const a = args();
  a.push("mutated");
  assertEquals(args().includes("mutated"), false, "args() returns a copy");
});

unitTest(
  "process - writeStdoutSync of 0 bytes returns 0, isTerminal is boolean",
  async () => {
    assertEquals(writeStdoutSync(new Uint8Array()), 0);
    assertEquals(typeof isTerminal("stdout"), "boolean");
    assertEquals(typeof isTerminal("stdin"), "boolean");
  },
);

unitTest(
  "process.exit - flushes 1 MiB written to a pipe before exiting (| wc -c)",
  async () => {
    const s = childScript(kWriteMiBThenExit3);
    try {
      const r = await exec(s.cmd, { args: s.args });
      assertEquals(r.code, 3);
      assertEquals(r.stdout.length, kMiB);
    } finally {
      s.cleanup();
    }
  },
);

unitTest(
  "process.exit - reader going away early is not a crash (| head -c 1)",
  async () => {
    const s = childScript(kWriteMiBThenExit3);
    try {
      const child = spawn(s.cmd, {
        args: s.args,
        stdin: "null",
        stdout: "piped",
        stderr: "piped",
        signal: AbortSignal.timeout(30_000),
      });
      const stderr = new Response(child.stderr!).text();
      const reader = child.stdout!.getReader();
      const first = await reader.read();
      assert(!first.done && first.value.length > 0);
      await reader.cancel(); // close our end of the pipe, like `head -c 1`
      const status = await child.status;
      assertEquals(
        status.code,
        3,
        "the code passed to exit() survives a broken pipe",
      );
      const err = await stderr;
      assert(!/BrokenPipe|EPIPE/.test(err), `unexpected stderr: ${err}`);
    } finally {
      s.cleanup();
    }
  },
);

unitTest("process.readStdinLines - an early break releases stdin", async () => {
  const s = childScript(`
for await (const line of p.readStdinLines()) {
  p.writeStdoutSync(new TextEncoder().encode("got:" + line + "\\n"));
  break;
}
p.writeStdoutSync(new TextEncoder().encode("done\\n"));
`);
  try {
    const child = spawn(s.cmd, {
      args: s.args,
      stdin: "piped",
      stdout: "piped",
      stderr: "null",
      signal: AbortSignal.timeout(30_000),
    });
    const writer = child.stdin!.getWriter();
    // Send two lines and keep stdin open: the child must exit anyway.
    await writer.write(new TextEncoder().encode("first\nsecond\n"));
    const out = await new Response(child.stdout!).text();
    const status = await child.status;
    await writer.close().catch(() => {});
    assertEquals(
      status.success,
      true,
      "child exited on its own (no timeout kill)",
    );
    assertEquals(out.replaceAll("\r\n", "\n"), "got:first\ndone\n");
  } finally {
    s.cleanup();
  }
});
