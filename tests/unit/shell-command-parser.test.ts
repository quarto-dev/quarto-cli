/*
 * shell-command-parser.test.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 *
 */
import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { parseShellRunCommand } from "../../src/core/run/shell.ts";

// deno-lint-ignore require-await
unitTest("shell-command-parser - simple command", async () => {
  const result = parseShellRunCommand("script.sh");
  assertEquals(result, ["script.sh"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - command with arguments", async () => {
  const result = parseShellRunCommand("script.sh arg1 arg2");
  assertEquals(result, ["script.sh", "arg1", "arg2"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - command with quoted argument", async () => {
  const result = parseShellRunCommand('script.sh "arg with spaces"');
  assertEquals(result, ["script.sh", "arg with spaces"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - command with multiple quoted arguments", async () => {
  const result = parseShellRunCommand('script.sh "arg 1" "arg 2"');
  assertEquals(result, ["script.sh", "arg 1", "arg 2"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - already quoted path", async () => {
  const result = parseShellRunCommand('"/path with space/script.sh"');
  assertEquals(result, ["/path with space/script.sh"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - already quoted path with arguments", async () => {
  const result = parseShellRunCommand('"/path with space/script.sh" arg1');
  assertEquals(result, ["/path with space/script.sh", "arg1"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - empty string", async () => {
  const result = parseShellRunCommand("");
  assertEquals(result, [""]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - multiple spaces between arguments", async () => {
  const result = parseShellRunCommand("script.sh    arg1    arg2");
  assertEquals(result, ["script.sh", "arg1", "arg2"]);
});

// deno-lint-ignore require-await
unitTest("shell-command-parser - mixed quoted and unquoted arguments", async () => {
  const result = parseShellRunCommand('script.sh arg1 "arg 2" arg3');
  assertEquals(result, ["script.sh", "arg1", "arg 2", "arg3"]);
});
