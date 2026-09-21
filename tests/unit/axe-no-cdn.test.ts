/*
 * axe-no-cdn.test.ts
 *
 * PR #14677 vendored axe-core so accessibility checking works offline and no
 * request goes to a CDN at runtime. The Playwright behavioral guard cannot
 * catch a *fallback* CDN load that only fires when the vendored file 404s
 * (the file returns 200 in tests). This static check does: it fails if either
 * the checker module or its dependency-wiring hard-codes a package-CDN host.
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";

const CDN_DENYLIST = [
  "skypack.dev",
  "unpkg.com",
  "jsdelivr.net",
  "esm.sh",
  "cdnjs.cloudflare.com",
];

const SCANNED_FILES = [
  "../../src/resources/formats/html/axe/axe-check.js",
  "../../src/format/html/format-html-axe.ts",
];

// deno-lint-ignore require-await
unitTest("axe dependency wiring references no package CDN (regression guard #14677)", async () => {
  for (const relPath of SCANNED_FILES) {
    const src = Deno.readTextFileSync(new URL(relPath, import.meta.url));
    const offenders = CDN_DENYLIST.filter((host) => src.includes(host));
    assertEquals(
      offenders,
      [],
      `${relPath} must not reference a package CDN (found: ${offenders.join(", ")}). ` +
        `axe-core is vendored (#14677); load it same-origin, not from a CDN.`,
    );
  }
});
