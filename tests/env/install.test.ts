/*
* install-tools.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { uninstallTool } from "../../src/command/install/install.ts";
import { testQuartoCmd } from "../test.ts";
import { noErrorsOrWarnings, printsMessage } from "../verify.ts";

testQuartoCmd(
  "install",
  ["--list-tools"],
  [
    noErrorsOrWarnings,
    printsMessage("INFO", /^tinytex\s+/),
    printsMessage("INFO", /^chromium\s+/),
  ],
);

testQuartoCmd(
  "install",
  ["tinytex"],
  [noErrorsOrWarnings, printsMessage("INFO", /^Installation successful$/m)],
  async () => {
    await uninstallTool("tinytex");
  },
);
