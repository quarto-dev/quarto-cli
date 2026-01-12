/*
 * cmd.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";
import { error, info } from "../../../deno_ral/log.ts";
import { join } from "../../../deno_ral/path.ts";
import { isWindows } from "../../../deno_ral/platform.ts";

export const typstGatherCommand = new Command()
  .name("typst-gather")
  .hidden()
  .description(
    "Gather Typst packages for offline/hermetic builds.\n\n" +
      "This command runs the typst-gather tool to download @preview packages " +
      "and copy @local packages to a local directory for use during Quarto builds.",
  )
  .action(async () => {
    // Get quarto root directory
    const quartoRoot = Deno.env.get("QUARTO_ROOT");
    if (!quartoRoot) {
      error(
        "QUARTO_ROOT environment variable not set. This command requires a development version of Quarto.",
      );
      Deno.exit(1);
    }

    // Path to the TOML config file (relative to this source file's location in the repo)
    const tomlPath = join(
      quartoRoot,
      "src/command/dev-call/typst-gather/typst-gather.toml",
    );

    // Path to the typst-gather binary
    const binaryName = isWindows ? "typst-gather.exe" : "typst-gather";
    const typstGatherBinary = join(
      quartoRoot,
      "package/typst-gather/target/release",
      binaryName,
    );

    // Check if binary exists
    try {
      await Deno.stat(typstGatherBinary);
    } catch {
      error(
        `typst-gather binary not found at ${typstGatherBinary}\n` +
          "Build it with: cd package/typst-gather && cargo build --release",
      );
      Deno.exit(1);
    }

    info(`Quarto root: ${quartoRoot}`);
    info(`Config: ${tomlPath}`);
    info(`Running typst-gather...`);

    // Run typst-gather from the quarto root directory
    const command = new Deno.Command(typstGatherBinary, {
      args: [tomlPath],
      cwd: quartoRoot,
      stdout: "inherit",
      stderr: "inherit",
    });

    const result = await command.output();

    if (!result.success) {
      error(`typst-gather failed with exit code ${result.code}`);
      Deno.exit(result.code);
    }

    info("Done!");
  });
