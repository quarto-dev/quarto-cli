import { testQuartoCmd } from "../../test.ts";
import { printsMessage } from "../../verify.ts";

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
