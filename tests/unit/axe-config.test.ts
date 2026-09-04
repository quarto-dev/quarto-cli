/*
 * axe-config.test.ts
 *
 * Flag parsing for `quarto call axe` (config.ts): the defaults, the list
 * splitting, and — above all — that a malformed flag is a named error rather
 * than a silently absorbed value. The parsers are private on purpose;
 * everything goes through `axeScanConfig`, exactly as the command does.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals, assertThrows } from "testing/asserts";
import {
  axeScanConfig,
  kDefaultSettle,
  kDefaultThemes,
  kDefaultTimeout,
  kDefaultViewports,
} from "../../src/command/call/axe/config.ts";

// deno-lint-ignore no-explicit-any
const config = (options: any = {}) => axeScanConfig(options, "_site");

unitTest(
  "axe config - defaults apply when no flags are given",
  // deno-lint-ignore require-await
  async () => {
    const parsed = config();
    assertEquals(parsed.siteDir, "_site");
    assertEquals(
      parsed.viewports.map((viewport) => viewport.label).join(","),
      kDefaultViewports,
    );
    assertEquals(parsed.themes.join(","), kDefaultThemes);
    assertEquals(parsed.timeout, kDefaultTimeout);
    assertEquals(parsed.settle, kDefaultSettle);
    assertEquals(parsed.pages, undefined);
    assertEquals(parsed.exclude, undefined);
    assertEquals(parsed.maxPages, undefined);
    assertEquals(parsed.failOn, undefined);
  },
);

unitTest(
  "axe config - comma lists are trimmed and empties dropped",
  // deno-lint-ignore require-await
  async () => {
    const parsed = config({ pages: " index.html , docs/**, " });
    assertEquals(parsed.pages, ["index.html", "docs/**"]);
  },
);

unitTest(
  "axe config - viewports parse WxH and reject everything else",
  // deno-lint-ignore require-await
  async () => {
    const parsed = config({ viewports: "800x600" });
    assertEquals(parsed.viewports, [{
      width: 800,
      height: 600,
      label: "800x600",
    }]);

    // a typo'd separator must be an error, not a silently absorbed default
    assertThrows(
      () => config({ viewports: "800×600" }),
      Error,
      "Invalid viewport",
    );
    assertThrows(
      () => config({ viewports: "big" }),
      Error,
      "Invalid viewport",
    );
    assertThrows(
      () => config({ viewports: " , " }),
      Error,
      "No viewports",
    );
  },
);

unitTest(
  "axe config - themes accept light/dark in any case, nothing else",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(config({ themes: "Light,DARK" }).themes, ["light", "dark"]);
    assertThrows(
      () => config({ themes: "solar" }),
      Error,
      "Invalid theme",
    );
    assertThrows(
      () => config({ themes: "," }),
      Error,
      "No themes",
    );
  },
);

unitTest(
  "axe config - integer flags reject zero/negative/garbage where meaningless",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(config({ maxPages: 3 }).maxPages, 3);
    assertThrows(() => config({ maxPages: 0 }), Error, "Invalid --max-pages");
    assertThrows(() => config({ maxPages: -1 }), Error, "Invalid --max-pages");
    assertThrows(
      () => config({ maxPages: "many" }),
      Error,
      "Invalid --max-pages",
    );

    assertThrows(() => config({ timeout: 0 }), Error, "Invalid --timeout");

    // zero is meaningful for --settle: "trust the readiness probe"
    assertEquals(config({ settle: 0 }).settle, 0);
    assertThrows(() => config({ settle: -1 }), Error, "Invalid --settle");
  },
);

unitTest(
  "axe config - --fail-on accepts the four impacts in any case, nothing else",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(config({ failOn: "SERIOUS" }).failOn, "serious");
    assertEquals(config({ failOn: "minor" }).failOn, "minor");
    assertThrows(
      () => config({ failOn: "bogus" }),
      Error,
      "Invalid --fail-on",
    );
    // impact vocabulary, not a rank — numbers don't parse
    assertThrows(() => config({ failOn: "1" }), Error, "Invalid --fail-on");
  },
);

unitTest(
  "axe config - option errors are AxeOptionError, so the CLI names the flag",
  // deno-lint-ignore require-await
  async () => {
    try {
      config({ viewports: "nope" });
      assert(false, "should have thrown");
    } catch (e) {
      assertEquals((e as Error).name, "AxeOptionError");
    }
  },
);
