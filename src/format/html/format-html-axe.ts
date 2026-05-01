/*
 * format-html-axe.ts
 *
 * Copyright (C) 2020-2025 Posit Software, PBC
 */

import { isHtmlDashboardOutput, isRevealjsOutput } from "../../config/format.ts";
import {
  Format,
  FormatDependency,
  FormatExtras,
  kDependencies,
} from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { encodeBase64 } from "../../deno_ral/encoding.ts";
import { join } from "../../deno_ral/path.ts";

function axeHtmlDependency(options: unknown): FormatDependency {
  return {
    name: "quarto-axe",
    head: `<script id="quarto-axe-checker-options" type="text/plain">${
      encodeBase64(JSON.stringify(options))
    }</script>`,
    scripts: [{
      name: "axe-check.js",
      path: formatResourcePath("html", join("axe", "axe-check.js")),
      attribs: { type: "module" },
    }],
  };
}

export function axeFormatDependencies(
  format: Format,
  options?: unknown,
): FormatExtras {
  if (!options) return {};

  // The axe report is developer chrome, not document content, so its colors
  // are literals here rather than theme-derived (`$body-bg` etc.). This keeps
  // the overlay readable regardless of the page's brand or theme — which
  // matters most when the user is auditing exactly those colors.
  const isRevealjs = isRevealjsOutput(format.pandoc);
  const isDashboard = isHtmlDashboardOutput(format.identifier["base-format"]);
  const sassDependency = isRevealjs ? "reveal-theme" : "bootstrap";

  // Base overlay rules shared by all formats. For revealjs, the `var(--r-*)`
  // lookups pick up the slide's actual colors at runtime; the literal
  // fallbacks apply everywhere else.
  const baseRules = `
body div.quarto-axe-report {
  position: fixed;
  bottom: 3rem;
  right: 3rem;
  padding: 1rem;
  border: 1px solid var(--r-main-color, #222);
  z-index: 9999;
  background-color: var(--r-background-color, #fff);
  color: var(--r-main-color, #222);
  max-height: 50vh;
  overflow-y: auto;
}

.quarto-axe-violation-help { padding-left: 0.5rem; }
.quarto-axe-violation-selector { padding-left: 1rem; }
.quarto-axe-violation-target {
  padding: 0.5rem;
  color: #2a76dd;
  text-decoration: underline;
  cursor: pointer;
}

.quarto-axe-hover-highlight {
  background-color: red;
  border: 2px solid red;
}`;

  // RevealJS: override overlay styles when report is embedded as a slide.
  // The slide's white background is set by the JS via data-background-color;
  // here we only need to keep text/link colors readable on white.
  const revealjsRules = isRevealjs
    ? `
.reveal .slides section.quarto-axe-report-slide {
  text-align: left;
  font-size: 0.55em;
  color: #222;
  h2 {
    margin-bottom: 0.5em;
    font-size: 1.8em;
    color: #222;
  }
  div.quarto-axe-report {
    position: static;
    padding: 0;
    border: none;
    background-color: transparent;
    color: #222;
    max-height: none;
    overflow-y: visible;
    z-index: auto;
  }
  .quarto-axe-violation-description {
    margin-top: 0.6em;
    font-weight: bold;
  }
  .quarto-axe-violation-target {
    font-size: 0.9em;
  }
}`
    : "";

  // Dashboard: report inside offcanvas sidebar (not fixed overlay).
  // Override Bootstrap's themed offcanvas vars so the panel keeps axe's own
  // colors regardless of brand/theme.
  const dashboardRules = isDashboard
    ? `
.quarto-dashboard .offcanvas.quarto-axe-offcanvas {
  --bs-offcanvas-bg: #fff;
  --bs-offcanvas-color: #222;
  .quarto-axe-report {
    position: static;
    padding: 0;
    border: none;
    background-color: transparent;
    color: #222;
    max-height: none;
    overflow-y: visible;
    z-index: auto;
  }
}
.quarto-dashboard .quarto-axe-toggle {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  z-index: 1040;
  border-radius: 50%;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}
.quarto-dashboard .quarto-axe-scanning {
  padding: 1rem;
  text-align: center;
  opacity: 0.7;
  font-style: italic;
}`
    : "";

  return {
    html: {
      [kDependencies]: [
        axeHtmlDependency(options),
      ],
      "sass-bundles": [
        {
          key: "axe",
          dependency: sassDependency,
          user: [{
            uses: "",
            defaults: "",
            functions: "",
            mixins: "",
            rules: baseRules + revealjsRules + dashboardRules,
          }],
        },
      ],
    },
  };
}
