/*
 * binary-mode-strip-env.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */
import { assert, assertEquals } from "testing/asserts";
import { unitTest } from "../test.ts";
import { sanitizeBinaryEnv, stripEnvVars } from "../quarto-cmd.ts";

const kNameRe = /^[A-Za-z_][A-Za-z0-9_]*$/;

unitTest(
  "binary-mode-strip-env - parsed list is well-formed",
  async () => {
    assert(stripEnvVars.length > 0, "strip list must not be empty");
    assertEquals(
      stripEnvVars.length,
      new Set(stripEnvVars).size,
      "strip list must not contain duplicates",
    );
    for (const name of stripEnvVars) {
      assert(kNameRe.test(name), `invalid variable name: ${name}`);
    }
    return Promise.resolve();
  },
);

unitTest(
  "binary-mode-strip-env - sanitizeBinaryEnv strips listed names, keeps others",
  async () => {
    const ambient: Record<string, string> = { UNRELATED_VAR: "keep" };
    for (const name of stripEnvVars) {
      ambient[name] = "leak";
    }
    const result = sanitizeBinaryEnv(ambient);
    for (const name of stripEnvVars) {
      assertEquals(result[name], undefined, `${name} should be stripped`);
    }
    assertEquals(result.UNRELATED_VAR, "keep");
    return Promise.resolve();
  },
);

unitTest(
  "binary-mode-strip-env - overlay wins and may reintroduce a stripped name",
  async () => {
    const [firstStripped] = stripEnvVars;
    const ambient: Record<string, string> = {
      [firstStripped]: "leak",
      SAME_NAME: "ambient",
    };
    const overlay = { [firstStripped]: "reintroduced", SAME_NAME: "overlay" };
    const result = sanitizeBinaryEnv(ambient, overlay);
    assertEquals(result[firstStripped], "reintroduced");
    assertEquals(result.SAME_NAME, "overlay");
    return Promise.resolve();
  },
);

unitTest(
  "binary-mode-strip-env - sanitizeBinaryEnv does not mutate its inputs",
  async () => {
    const [firstStripped] = stripEnvVars;
    const ambient: Record<string, string> = {
      [firstStripped]: "leak",
      UNRELATED_VAR: "keep",
    };
    const overlay = { OVERLAY_VAR: "value" };
    const ambientBefore = { ...ambient };
    const overlayBefore = { ...overlay };

    sanitizeBinaryEnv(ambient, overlay);

    assertEquals(ambient, ambientBefore);
    assertEquals(overlay, overlayBefore);
    return Promise.resolve();
  },
);
