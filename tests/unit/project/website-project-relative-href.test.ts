/*
 * website-project-relative-href.test.ts
 *
 * Tests for projectRelativeHref path normalization
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { projectRelativeHref } from "../../../src/project/types/website/website-shared.ts";

// deno-lint-ignore require-await
unitTest("projectRelativeHref - document relative path", async () => {
  assertEquals(projectRelativeHref("thumb.png", "news"), "/news/thumb.png");
  assertEquals(projectRelativeHref("./thumb.png", "news"), "/news/thumb.png");
  assertEquals(projectRelativeHref("img/thumb.png", "."), "/img/thumb.png");
  assertEquals(projectRelativeHref("../thumb.png", "news"), "/thumb.png");
});

// deno-lint-ignore require-await
unitTest("projectRelativeHref - project relative path", async () => {
  assertEquals(projectRelativeHref("/thumb.png", "news"), "/thumb.png");
  assertEquals(
    projectRelativeHref("/images\\thumb.png", "news"),
    "/images/thumb.png",
  );
});

// deno-lint-ignore require-await
unitTest("projectRelativeHref - url is left alone", async () => {
  assertEquals(
    projectRelativeHref("https://example.com/a.png", "news"),
    "https://example.com/a.png",
  );
});
