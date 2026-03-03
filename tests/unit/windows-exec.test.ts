/*
 * windows-exec.test.ts
 *
 * Tests for Windows command execution utilities.
 * Validates fix for https://github.com/quarto-dev/quarto-cli/issues/13997
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "testing/asserts";
import { isWindows } from "../../src/deno_ral/platform.ts";
import { join } from "../../src/deno_ral/path.ts";
import { requireQuoting, safeWindowsExec } from "../../src/core/windows.ts";
import { execProcess } from "../../src/core/process.ts";

// Test that requireQuoting correctly quotes paths with spaces
unitTest(
  "requireQuoting - quotes paths with spaces",
  // deno-lint-ignore require-await
  async () => {
    const result = requireQuoting([
      "C:\\Program Files\\dart-sass\\sass.bat",
      "C:\\My Project\\style.scss",
      "C:\\My Project\\style.css",
    ]);

    assert(result.status === true, "Should indicate quoting was required");
    assertEquals(result.args[0], '"C:\\Program Files\\dart-sass\\sass.bat"');
    assertEquals(result.args[1], '"C:\\My Project\\style.scss"');
    assertEquals(result.args[2], '"C:\\My Project\\style.css"');
  },
  { ignore: !isWindows },
);

// Test that requireQuoting does not quote clean paths (no special chars)
// Note: Windows paths with drive letters (C:) ARE quoted due to the colon
unitTest(
  "requireQuoting - no quoting for clean paths",
  // deno-lint-ignore require-await
  async () => {
    const result = requireQuoting([
      "sass.bat",
      "input.scss",
      "output.css",
    ]);

    assert(result.status === false, "Should indicate no quoting needed");
    assertEquals(result.args[0], "sass.bat");
    assertEquals(result.args[1], "input.scss");
    assertEquals(result.args[2], "output.css");
  },
  { ignore: !isWindows },
);

// Test that safeWindowsExec passes arguments with spaces correctly
unitTest(
  "safeWindowsExec - passes spaced args correctly",
  async () => {
    const tempDir = Deno.makeTempDirSync({ prefix: "quarto-test" });

    try {
      // Create batch file that echoes args (use %~1 to strip quotes)
      const echoArgs = join(tempDir, "echo-args.bat");
      Deno.writeTextFileSync(
        echoArgs,
        `@echo off
echo ARG1: %~1
echo ARG2: %~2
`,
      );

      const spaced1 = "C:\\My Project\\input.scss";
      const spaced2 = "C:\\My Project\\output.css";
      const quoted = requireQuoting([echoArgs, spaced1, spaced2]);

      const result = await safeWindowsExec(
        quoted.args[0],
        quoted.args.slice(1),
        (cmd) =>
          execProcess({
            cmd: cmd[0],
            args: cmd.slice(1),
            stdout: "piped",
            stderr: "piped",
          }),
      );

      assert(result.success, "Should execute successfully");
      assert(
        result.stdout?.includes(spaced1),
        `Arg1 should be passed correctly. Got: ${result.stdout}`,
      );
      assert(
        result.stdout?.includes(spaced2),
        `Arg2 should be passed correctly. Got: ${result.stdout}`,
      );
    } finally {
      Deno.removeSync(tempDir, { recursive: true });
    }
  },
  { ignore: !isWindows },
);

// Test that safeWindowsExec handles program paths with spaces (issue #13997)
// This is the core bug: Deno has issues executing .bat files when both the
// command path AND arguments contain spaces.
unitTest(
  "safeWindowsExec - handles program path with spaces (issue #13997)",
  async () => {
    const tempDir = Deno.makeTempDirSync({ prefix: "quarto-test" });

    try {
      // Create directory with spaces (simulates C:\Program Files\)
      const spacedDir = join(tempDir, "Program Files", "tool");
      Deno.mkdirSync(spacedDir, { recursive: true });

      // Create batch file in spaced path
      const program = join(spacedDir, "echo-success.bat");
      Deno.writeTextFileSync(
        program,
        `@echo off
echo SUCCESS
echo ARG: %~1
`,
      );

      const spacedArg = "C:\\My Project\\file.txt";
      const quoted = requireQuoting([program, spacedArg]);

      const result = await safeWindowsExec(
        quoted.args[0],
        quoted.args.slice(1),
        (cmd) =>
          execProcess({
            cmd: cmd[0],
            args: cmd.slice(1),
            stdout: "piped",
            stderr: "piped",
          }),
      );

      assert(result.success, "Should execute program in spaced path");
      assert(
        result.stdout?.includes("SUCCESS"),
        `Program should run. Got: ${result.stdout}`,
      );
      assert(
        result.stdout?.includes(spacedArg),
        `Arg should be passed correctly. Got: ${result.stdout}`,
      );
    } finally {
      Deno.removeSync(tempDir, { recursive: true });
    }
  },
  { ignore: !isWindows },
);
