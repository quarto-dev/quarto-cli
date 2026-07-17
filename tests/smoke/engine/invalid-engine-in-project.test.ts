import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

// The previous version of this test wrapped an (un-awaited) assertRejects
// around an in-process quarto() call, so it passed vacuously. Asserting on
// the ERROR log record works in both dev and binary (QUARTO_TEST_BIN) modes:
// in binary mode the message reaches the log via the child's error logging
// (or the synthetic record carrying the stderr tail).
testQuartoCmd(
  "render",
  ["docs/engine/invalid-project/notebook.qmd"],
  [
    printsMessage({
      level: "ERROR",
      regex:
        /'invalid-engine' was specified in the list of engines in the project settings but it is not a valid engine/,
    }),
  ],
  {},
  "invalid engines option errors",
);
