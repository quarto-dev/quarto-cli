/*
 * append-log-options.test.ts
 *
 * appendLogOptions (src/core/log.ts) forwards --log/--log-level/--log-format/
 * --quiet to a command's direct subcommands. `.hidden()` only controls
 * whether a subcommand is advertised in `--help` output (e.g. `quarto call
 * axe`, an experimental subcommand) — it must not also exclude the
 * subcommand from receiving forwarded log options.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assert } from "testing/asserts";
import { Command } from "cliffy/command/mod.ts";
import { appendLogOptions } from "../../../src/core/log.ts";

unitTest(
  "appendLogOptions forwards log options to hidden subcommands",
  // deno-lint-ignore require-await
  async () => {
    const visible = new Command().name("visible");
    const hidden = new Command().name("hidden").hidden();
    const parent = new Command()
      .name("parent")
      .command("visible", visible)
      .command("hidden", hidden);

    appendLogOptions(parent);

    const forwarded = parent.getCommands(true).find(
      (cmd) => cmd.getName() === "hidden",
    );
    assert(
      forwarded,
      "hidden subcommand should still be reachable via getCommands(true)",
    );
    for (const name of ["log", "log-level", "log-format", "quiet"]) {
      assert(
        forwarded!.hasOption(name),
        `hidden subcommand is missing forwarded --${name} option`,
      );
    }
  },
);
