/*
 * reveal-tabset-fragments.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { assertEquals } from "../asserts.ts";
import {
  hasTabsetFragmentsClass,
  revealTabsetFragmentsPlugin,
} from "../../src/format/reveal/format-reveal-plugin.ts";
import { createMockFormat } from "./format-utils.ts";
import { unitTest } from "../test.ts";

unitTest(
  "hasTabsetFragmentsClass - class on a tabset",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      hasTabsetFragmentsClass("::: {.panel-tabset .tabset-fragments}\n"),
      true,
    );
    assertEquals(
      hasTabsetFragmentsClass("::: {.tabset-fragments .panel-tabset}\n"),
      true,
    );
    assertEquals(
      hasTabsetFragmentsClass("::: {.panel-tabset .tabset-fragments}"),
      true,
    );
  },
);

unitTest(
  "hasTabsetFragmentsClass - opt-out class and no class",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      hasTabsetFragmentsClass("::: {.panel-tabset .no-tabset-fragments}\n"),
      false,
    );
    assertEquals(hasTabsetFragmentsClass("::: {.panel-tabset}\n"), false);
    assertEquals(hasTabsetFragmentsClass(""), false);
  },
);

unitTest(
  "revealTabsetFragmentsPlugin - registration",
  // deno-lint-ignore require-await
  async () => {
    const off = createMockFormat({});
    assertEquals(
      revealTabsetFragmentsPlugin(off, "::: {.panel-tabset}\n"),
      undefined,
    );

    const deckOn = createMockFormat({ metadata: { "tabset-fragments": true } });
    assertEquals(
      revealTabsetFragmentsPlugin(deckOn, "")?.config,
      { tabsetFragments: true },
    );

    const classOnly = revealTabsetFragmentsPlugin(
      off,
      "::: {.panel-tabset .tabset-fragments}\n",
    );
    assertEquals(classOnly?.config, { tabsetFragments: false });
  },
);
