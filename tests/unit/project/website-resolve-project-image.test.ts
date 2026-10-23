/*
 * website-resolve-project-image.test.ts
 *
 * Tests for resolveProjectImage href resolution and size lookup
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../../test.ts";
import { assertEquals } from "testing/asserts";
import { docs } from "../../utils.ts";
import { resolveProjectImage } from "../../../src/project/types/website/website-shared.ts";

// site.png and news/thumb.png are both 600x400
const dir = docs("website-image-base");
const size = { height: 400, width: 600 };

// deno-lint-ignore require-await
unitTest("resolveProjectImage - document relative", async () => {
  assertEquals(resolveProjectImage("thumb.png", dir, "news"), {
    href: "/news/thumb.png",
    ...size,
  });
});

// deno-lint-ignore require-await
unitTest("resolveProjectImage - parent relative", async () => {
  assertEquals(resolveProjectImage("../site.png", dir, "news"), {
    href: "/site.png",
    ...size,
  });
});

// deno-lint-ignore require-await
unitTest("resolveProjectImage - project relative", async () => {
  const expected = { href: "/site.png", ...size };
  assertEquals(resolveProjectImage("/site.png", dir, "news"), expected);
  assertEquals(resolveProjectImage("site.png", dir), expected);
  assertEquals(resolveProjectImage("./site.png", dir), expected);
});

// deno-lint-ignore require-await
unitTest("resolveProjectImage - normalized", async () => {
  assertEquals(resolveProjectImage("news//thumb.png", dir), {
    href: "/news/thumb.png",
    ...size,
  });
  // A leading slash keeps the href as written, the size is still read
  assertEquals(resolveProjectImage("/news//thumb.png", dir), {
    href: "/news//thumb.png",
    ...size,
  });
});

// deno-lint-ignore require-await
unitTest("resolveProjectImage - url", async () => {
  assertEquals(
    resolveProjectImage("https://example.com/a.png", dir, "news"),
    {
      href: "https://example.com/a.png",
      height: undefined,
      width: undefined,
    },
  );
});

// deno-lint-ignore require-await
unitTest("resolveProjectImage - missing file", async () => {
  assertEquals(resolveProjectImage("nope.png", dir), {
    href: "/nope.png",
    height: undefined,
    width: undefined,
  });
});
