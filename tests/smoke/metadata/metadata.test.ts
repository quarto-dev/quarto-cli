/*
* metadata.test.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { assert } from "testing/asserts.ts";
import { Metadata } from "../../../src/config/metadata.ts";
import { ExecuteOutput, testQuartoCmd } from "../../test.ts";
import { docs } from "../../utils.ts";
import { noErrorsOrWarnings, printsJson } from "../../verify.ts";

export const metaAppearsValid = {
  name: "JSON Metadata Appears Valid",
  verify: (outputs: ExecuteOutput[]) => {
    outputs.filter((out) => out.msg !== "" && out.levelName === "INFO").forEach(
      (out) => {
        if (out.msg !== "" && out.levelName === "INFO") {
          let json = undefined;
          try {
            json = JSON.parse(out.msg);
          } catch {
            assert(false, "Error parsing JSON returned by quarto meta");
          }

          const meta = json["html"] as Metadata;
          const requiredKeys = [
            "execute",
            "render",
            "pandoc",
            "metadata",
            "extensions",
          ];
          const keys = Object.keys(meta);

          requiredKeys.forEach((key) => {
            assert(
              keys.includes(key),
              `Missing ${key} key in meta`,
            );

            const subData = meta[key] as Metadata;
            assert(
              Object.keys(subData).length > 0,
              `Key ${key} has no values in meta`,
            );
          });
        }
      },
    );
    return Promise.resolve();
  },
};

testQuartoCmd(
  "metadata",
  [docs("test.Rmd")],
  [
    noErrorsOrWarnings,
  ],
);

testQuartoCmd(
  "metadata",
  [docs("test.Rmd"), "--json"],
  [
    noErrorsOrWarnings,
    printsJson,
    metaAppearsValid,
  ],
);
