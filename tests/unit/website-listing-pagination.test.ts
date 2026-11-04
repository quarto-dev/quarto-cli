/*
 * website-listing-pagination.test.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assert, assertEquals } from "../asserts.ts";
import { templateJsScript } from "../../src/project/types/website/listing/website-listing-template.ts";
import { resolvePaginationOptions } from "../../src/project/types/website/listing/website-listing-read.ts";
import { Listing } from "../../src/project/types/website/listing/website-listing-shared.ts";

const itemText =
  `item: "<li class='page-item'><a class='page page-link' href='#'></a></li>"`;

const script = (pagination?: Record<string, number>) => {
  const listing = {
    "page-size": 1,
    "field-filter": [],
    "field-sort": [],
    fields: [],
    ...(pagination ? { pagination } : {}),
  } as unknown as Listing;
  return templateJsScript("listing", listing, 10);
};

// deno-lint-ignore require-await
unitTest(
  "listing pagination - no option emits the unchanged item text",
  async () => {
    assert(script().includes(`pagination: { ${itemText} },`));
  },
);

// deno-lint-ignore require-await
unitTest("listing pagination - outer-window-left emits left only", async () => {
  const js = script({ "outer-window-left": 2 });
  assert(js.includes(`pagination: { left: 2, ${itemText} },`));
  assert(!js.includes("outerWindow"));
  assert(!js.includes("OuterWindow"));
});

// deno-lint-ignore require-await
unitTest("listing pagination - outer-window sets both sides", async () => {
  const js = script({ "outer-window": 1 });
  assert(js.includes(`pagination: { left: 1, right: 1, ${itemText} },`));
  assert(!js.includes("innerWindow"));
  assert(!js.includes("outerWindow"));
});

// deno-lint-ignore require-await
unitTest(
  "listing pagination - a side overrides outer-window, zero included",
  async () => {
    const js = script({
      "inner-window": 1,
      "outer-window": 2,
      "outer-window-left": 0,
    });
    assert(
      js.includes(
        `pagination: { innerWindow: 1, left: 0, right: 2, ${itemText} },`,
      ),
    );
  },
);

// deno-lint-ignore require-await
unitTest("listing pagination - invalid values resolve to nothing", async () => {
  assertEquals(
    resolvePaginationOptions("x", {
      "inner-window": 0,
      "outer-window": 1.5,
      "outer-window-right": -1,
    }),
    undefined,
  );
});

// deno-lint-ignore require-await
unitTest("listing pagination - only numbers are accepted", async () => {
  for (const value of ["3", null, true, [], {}]) {
    assertEquals(
      resolvePaginationOptions("x", { "inner-window": value }),
      undefined,
      `inner-window: ${JSON.stringify(value)}`,
    );
  }
});

// deno-lint-ignore require-await
unitTest(
  "listing pagination - valid options survive an invalid one",
  async () => {
    assertEquals(
      resolvePaginationOptions("x", { "inner-window": 0, "outer-window": 1 }),
      { "outer-window": 1 },
    );
  },
);

// deno-lint-ignore require-await
unitTest(
  "listing pagination - a block that is not an object resolves to nothing",
  async () => {
    for (const value of ["wide", 3, true, ["inner-window"]]) {
      assertEquals(resolvePaginationOptions("x", value), undefined);
    }
  },
);
