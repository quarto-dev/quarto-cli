/*
 * preview-external-links.test.ts
 *
 * Tests that a preview classifies links against the origin the browser is on,
 * so a preview reached through a proxy does not treat its own internal links
 * as external. Regression test for #14865.
 *
 * Copyright (C) 2026 Posit Software, PBC
 */

import { unitTest } from "../test.ts";
import { assertEquals } from "testing/asserts";
import {
  isLocalHref,
} from "../../src/webui/quarto-preview/src/frame/link-origin.ts";

// On Workbench the browser is on the deployment host while the preview server
// infers its own origin from the request and sees localhost.
const kBrowserHref =
  "https://workbench.example.com/s/abc123/p/c0e15ada/?quartoPreviewReqId=1788374125840";
const kServerOrigin = "http://localhost:5158";

unitTest(
  "isLocalHref - proxied same-origin link is local (#14865)",
  // deno-lint-ignore require-await
  async () => {
    // The defect: comparing against the server-inferred origin classified an
    // internal link as external, so the embedder opened it in a new tab.
    assertEquals(
      isLocalHref(
        "https://workbench.example.com/s/abc123/p/c0e15ada/#tab-2",
        kBrowserHref,
        kServerOrigin,
      ),
      true,
    );
  },
);

unitTest(
  "isLocalHref - same-origin link outside the proxy path is local",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isLocalHref(
        "https://workbench.example.com/other/page.html",
        kBrowserHref,
        kServerOrigin,
      ),
      true,
    );
  },
);

unitTest(
  "isLocalHref - relative href resolves against the browser location",
  // deno-lint-ignore require-await
  async () => {
    // A comparison against an absolute origin always misclassifies a relative
    // href, since neither "#tab-2" nor "about.html" starts with an origin.
    assertEquals(
      [
        isLocalHref("#tab-2", kBrowserHref, kServerOrigin),
        isLocalHref("about.html", kBrowserHref, kServerOrigin),
        isLocalHref("/s/abc123/p/c0e15ada/", kBrowserHref, kServerOrigin),
      ],
      [true, true, true],
    );
  },
);

unitTest(
  "isLocalHref - link matching the server origin is local",
  // deno-lint-ignore require-await
  async () => {
    // A preview reached directly at localhost keeps its previous behavior.
    assertEquals(
      isLocalHref(
        "http://localhost:5158/other.html",
        "http://localhost:5158/index.html?quartoPreviewReqId=1",
        kServerOrigin,
      ),
      true,
    );
  },
);

unitTest(
  "isLocalHref - genuinely external link is external",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isLocalHref("https://quarto.org/docs/", kBrowserHref, kServerOrigin),
      false,
    );
  },
);

unitTest(
  "isLocalHref - hostname that merely starts with the local origin is external",
  // deno-lint-ignore require-await
  async () => {
    // This host starts with the browser origin as a string, so classifying
    // with startsWith would call it local and suppress the embedder's handling
    // of a link that leaves the deployment.
    assertEquals(
      isLocalHref(
        "https://workbench.example.com.evil.test/phish",
        kBrowserHref,
        kServerOrigin,
      ),
      false,
    );
  },
);

unitTest(
  "isLocalHref - same host on a different port or scheme is external",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      [
        isLocalHref(
          "https://workbench.example.com:8443/page",
          kBrowserHref,
          kServerOrigin,
        ),
        isLocalHref(
          "http://workbench.example.com/page",
          kBrowserHref,
          kServerOrigin,
        ),
      ],
      [false, false],
    );
  },
);

unitTest(
  "isLocalHref - unparseable href is external",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      isLocalHref("http://[unclosed", kBrowserHref, kServerOrigin),
      false,
    );
  },
);

unitTest(
  "isLocalHref - invalid server origin still classifies against the browser",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      [
        isLocalHref(
          "https://workbench.example.com/s/abc123/p/c0e15ada/#tab-2",
          kBrowserHref,
          "not a url",
        ),
        isLocalHref("https://quarto.org/docs/", kBrowserHref, "not a url"),
      ],
      [true, false],
    );
  },
);

unitTest(
  "isLocalHref - non-http scheme is external",
  // deno-lint-ignore require-await
  async () => {
    assertEquals(
      [
        isLocalHref("mailto:hello@example.com", kBrowserHref, kServerOrigin),
        isLocalHref("https://quarto.org", kBrowserHref, kServerOrigin),
      ],
      [false, false],
    );
  },
);
