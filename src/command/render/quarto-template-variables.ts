/*
 * quarto-template-variables.ts
 *
 * Copyright (C) 2020-2026 Posit Software, PBC
 */

import { FormatLanguage } from "../../config/types.ts";
import { PandocOptions } from "./types.ts";

// =============================================================================
// THIS FILE IS THE CONTRIBUTION POINT for the `quarto.*` Pandoc
// template-variable namespace.
//
// To expose a new internal Quarto value to Pandoc templates as
// `$quarto.<area>.<key>$`:
//   1. Add a field to the `QuartoTemplateVariables` interface below
//      (use the tightest existing type, e.g. `FormatLanguage`).
//   2. Add a contribution branch inside `buildQuartoTemplateVariables`
//      that reads the value from `options` and assigns it to that field.
//   3. (Optional) Update llm-docs/localization-architecture.md if the
//      new key participates in localization.
//
// `quarto.*` is an INTERNAL namespace. The user-facing override path for
// localized strings is the top-level `language:` YAML key (resolved by
// formatLanguage in src/core/language.ts and merged into
// options.format.language before this builder runs). Users are not
// expected to set `variables.quarto.*` directly in YAML frontmatter,
// and the schema does not surface it as a user option. If a user does
// set it explicitly as an escape hatch, the wiring in
// `src/command/render/defaults.ts:generateDefaults` honors their value
// on collision instead of clobbering — but new contributors to this
// file should not design APIs around that path.
//
// Values declared here flow into the defaults-file `variables:` section
// only — never into `format.metadata`. That means writers with
// `+yaml_metadata_block` (markdown, native, json) do NOT serialize them
// back into the rendered YAML header, and Lua filters do not see them
// (Lua filter params are a separate channel; see
// `src/command/render/filters.ts:languageFilterParams`).
//
// Templates access these values via dotted form, e.g.
// `$quarto.language.crossref-ch-prefix$`. The single wiring point that
// surfaces the result into Pandoc lives in
// `src/command/render/defaults.ts:generateDefaults`.
// =============================================================================

export interface QuartoTemplateVariables {
  language?: FormatLanguage;
}

export function buildQuartoTemplateVariables(
  options: PandocOptions,
): QuartoTemplateVariables | undefined {
  const vars: QuartoTemplateVariables = {};

  if (options.format.language) {
    vars.language = options.format.language;
  }

  return Object.keys(vars).length > 0 ? vars : undefined;
}
