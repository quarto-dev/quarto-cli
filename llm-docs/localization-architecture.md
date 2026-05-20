---
main_commit: 4aa86e524
analyzed_date: 2026-05-20
key_files:
  - src/resources/language/_language.yml
  - src/resources/language/_language-fr.yml
  - src/core/language.ts
  - src/command/render/render-contexts.ts
  - src/command/render/pandoc.ts
  - src/command/render/filters.ts
  - src/command/render/defaults.ts
  - src/command/render/quarto-template-variables.ts
  - src/resources/filters/crossref/meta.lua
  - src/resources/filters/crossref/refs.lua
  - src/resources/filters/crossref/format.lua
  - src/resources/filters/modules/authors.lua
  - src/resources/filters/modules/callouts.lua
  - src/resources/filters/layout/meta.lua
  - src/resources/formats/html/pandoc/html.template
  - src/resources/formats/html/pandoc/title-block.html
  - src/resources/formats/html/templates/title-metadata.html
  - src/resources/formats/pdf/pandoc/latex.template
  - src/resources/formats/pdf/pandoc/babel-lang.tex
  - src/resources/formats/pdf/pandoc/toc.tex
  - src/resources/formats/beamer/pandoc/beamer.template
  - src/resources/formats/typst/pandoc/typst.template
  - src/resources/formats/typst/pandoc/quarto/typst-template.typ
  - src/resources/formats/typst/pandoc/quarto/typst-show.typ
  - src/resources/extension-subtrees/orange-book/_extensions/orange-book/typst-show.typ
  - src/format/html/format-html-shared.ts
  - src/format/html/format-html-bootstrap.ts
  - src/format/html/format-html-appendix.ts
  - src/format/pdf/format-pdf.ts
  - src/project/types/book/book-chapters.ts
  - src/project/types/website/listing/website-listing-template.ts
  - src/project/types/website/website-search.ts
---

# Localization architecture

How Quarto turns `lang: fr` (and similar) into localized strings across HTML, LaTeX/PDF, Typst, and the various extension points. Required reading before adding or wiring a new translatable string.

## TL;DR map

```
_language.yml + _language-<lang>.yml
        │
        ▼
core/language.ts (formatLanguage, translationsForLang)
        │
        ▼
format.language          (per-render Format object)
        │
        ├─► languageFilterParams (filters.ts)                  [2a]
        │     └─► Lua filter params (JSON)
        │           └─► param("key", default) in Lua filters
        │                 └─► written into Pandoc AST or meta
        │
        ├─► explicit copies into format.metadata (pandoc.ts)   [2b]
        │     └─► Pandoc YAML metadata
        │           └─► $key$ in Pandoc templates
        │           └─► leaked into +yaml_metadata_block writers
        │
        ├─► direct TS reads (HTML format extras, listings,     [2c]
        │     search, appendices) writing into rendered DOM
        │
        └─► defaults-file variables.quarto.language            [2d]
              (defaults.ts:generateDefaults)
              └─► Pandoc template variables
                    └─► $quarto.language.<key>$ in any template
                    └─► NEVER reaches format.metadata,
                        so no +yaml_metadata_block leakage
```

Plus format-native localization (LaTeX babel, Typst `set text(lang:)`) that Quarto does NOT control — the language just flows as a value Pandoc/Typst/babel know to interpret.

## 1. Source of truth and resolution

- `src/resources/language/_language.yml` — base English defaults for every Quarto-defined localized key.
- `src/resources/language/_language-<bcp47>.yml` — overrides per language. `_language-fr.yml` provides French; `_language-pt-BR.yml` provides Brazilian Portuguese with `_language-pt.yml` as parent.
- `src/resources/schema/definitions.yml` — `format-language` schema enumerates valid keys. Adding a new key to YAML requires also adding it here.
- `src/config/constants.ts:320-383` — `kCrossref*Title`, `kCrossref*Prefix`, `k*Title`, `kListingPage*` constants for every key, plus `kLanguageDefaultsKeys` array used as the gatekeeper.
- `src/core/language.ts:135` — `readDefaultLanguageTranslations(lang)` resolves the base file, calls `readLanguageTranslations` which walks BCP-47 subtags and merges variation files.
- `src/core/language.ts:103-130` — `readLanguageTranslations`: per subtag, loads `_language-<variation>.yml` and merges onto base.
- `src/core/language.ts:161-188` — `translationsForLang(language, lang)`: filters to `kLanguageDefaultsKeys`, `crossref-*-title`, `crossref-*-prefix`, then merges variation sub-objects (`fr-CA` falls back to `fr`).
- `src/core/language.ts:190-211` — `formatLanguage(metadata, language, flags)`: reads `kLang` from flags/metadata (default `"en"`), calls `readDefaultLanguageTranslations`, merges any user-provided `language:` block, calls `translationsForLang`.
- `src/command/render/render-contexts.ts:254-258` — assigns the resolved object onto every `Format`:
  ```ts
  formats[formatKey].format.language = await formatLanguage(
    formats[formatKey].format.metadata,
    formats[formatKey].format.language,
    options.flags,
  );
  ```

After this point, `format.language` is the in-memory canonical map of `{ "crossref-ch-prefix": "Chapitre", "toc-title-document": "Table des matières", ... }`.

## 2. Four downstream surfaces from `format.language`

`format.language` is not consumed directly by Pandoc. Four distinct pipelines plug into it.

### 2a. Lua filter params (the broad channel)

`src/command/render/filters.ts:465-496` (`languageFilterParams`) auto-spreads selected language keys into Lua filter params:

- Always: `[kCodeSummary]`, `[kTocTitleDocument]`.
- For each crossref type (`fig`, `tbl`, `lst`, `thm`, ...): `params["crossref-<type>-prefix"] = language["crossref-<type>-title"]` — the prefix-from-title default.
- Bulk: every key in `format.language` that starts with `callout-`, `crossref-`, or `environment-` is copied verbatim.

`src/command/render/pandoc.ts:492` separately puts the whole language table into filter params at key `"language"`:

```ts
formatFilterParams["language"] = options.format.language;
```

Both routes coexist in filter params JSON. Lua filters access them via:
- `param("language", nil)["title-block-author-single"]` — convenient when reading many keys (used in `modules/authors.lua:854`).
- `param("crossref-ch-prefix", "Chapter")` — convenient with default fallback (used throughout `crossref/`).

Same underlying data, just different access ergonomics. Pick the style that matches the file you are editing.

### 2b. Direct `format.metadata` writes in TS

`format.metadata` becomes Pandoc YAML metadata, so its keys resolve as `$key$` in Pandoc templates. Quarto explicitly copies a few language values across in `src/command/render/pandoc.ts`:

- `pandoc.ts:498-503` — `format.metadata[kTocTitle]` from website or document variant of toc title.
- `pandoc.ts:520-522` — `format.metadata[kAbstractTitle]` from `kSectionTitleAbstract`.

Both are gated "only if user did not already set the metadata key".

### 2c. Direct TS reads (`format.language[key]` in renderer code)

Some HTML/PDF rendering code reads `format.language[...]` directly to populate DOM nodes or JS configs rather than going through Pandoc metadata:

- `src/format/html/format-html-shared.ts:356,372,478` — footnotes/references headings, copy-button tooltip.
- `src/format/html/format-html-bootstrap.ts:711,735,753,757,905` — dev container, Binder, Other Links, Code Links, Related Formats.
- `src/format/html/format-html-appendix.ts:240,252,282,301,318,327` — license, reuse, copyright, BibTeX attribution, cite-as, citation labels.
- `src/format/asciidoc/format-asciidoc.ts:244` — references section.
- `src/project/types/website/website-search.ts:613-617` — copies all `search-*` keys into search JS options.
- `src/project/types/website/listing/website-listing-read.ts:153-163` — listing column header labels.
- `src/project/types/website/listing/website-listing-template.ts:343,353,366,375` — listing sort UI.
- `src/project/types/book/book-chapters.ts:149` — uses `kCrossrefApxPrefix` to format appendix chapter titles ("Annexe A — ...").
- `src/render/notebook/notebook-contributor-html.ts:120,174,208,209` — notebook preview UI labels.
- `src/command/render/codetools.ts:211,215,221,265,330` — code tools menu labels.

These bypass both Pandoc metadata and Lua filters. The string lands directly in the rendered DOM or in a JSON blob the front-end JS reads.

### 2d. Pandoc defaults-file `variables:` section (the bulk template channel)

`src/command/render/quarto-template-variables.ts` defines the `QuartoTemplateVariables` interface and the `buildQuartoTemplateVariables(options)` builder that collects every contribution to the reserved `quarto.*` Pandoc template-variable namespace. Today the only field is `language: FormatLanguage`, sourced verbatim from `options.format.language`. `src/command/render/defaults.ts:generateDefaults` calls the builder and spreads the result under `allDefaults.variables.quarto`. When `writeDefaultsFile` serializes `allDefaults` to YAML, the nested map lands in the `variables:` section of the defaults file. Pandoc reads structured `variables:` values natively (per the Pandoc manual under `--variable`: *"Structured values (lists, maps) … can be assigned in the variables section of a defaults file"*).

From any Pandoc template — built-in (`html.template`, `latex.template`, `typst-template.typ`), extension partial, or custom user template — every localized key is then accessible as:

```pandoc
$quarto.language.<key>$
```

For example, `$quarto.language.crossref-ch-prefix$` resolves to `Chapitre` when `lang: fr` is set. Hyphens within the leaf segment are valid Pandoc template-variable syntax (manual: *"Variable names can include letters, numbers, underscores, hyphens, and periods"*).

This is the channel of choice for new template consumers because:
- It is bulk — every key in `format.language` is exposed, no per-key wiring.
- It does **not** touch `format.metadata`, so writers with `+yaml_metadata_block` (markdown, native, json) never serialize the values back into the document YAML header.
- It does not depend on Lua filter ordering or AST traversal.
- Pandoc's last-write-wins rule between defaults-file variables and `--variable` on the CLI lets users override individual values without breaking the bulk channel.

It does **not** replace 2a — Lua filters still need `param("key")` because Pandoc templates and Lua filter params are independent surfaces. It does not replace 2b for the two specific keys that ship via `pandoc.ts` today (`toc-title`, `abstract-title`) — those are kept so existing built-in templates that read the flat `$toc-title$` and `$abstract-title$` keep working without a template change. New consumers should reach for 2d.

## 3. Format-by-format breakdown

### 3a. HTML

Localization paths used:

- **Document `lang` attribute**: `_language.yml` lookup not involved. `lang:` flows as Pandoc-native metadata, template renders `<html lang="$lang$" xml:lang="$lang$">` (`html.template:2`).
- **TOC title**: `$toc-title$` resolved via channel 2b. Used in `html.template:60`, `toc.html:3`.
- **Abstract title**: `$abstract-title$` resolved via 2b. Used in `html.template:51`, `title-block.html:15`.
- **Title block labels** (`Authors`, `Affiliations`, `Published`, `Modified`, `Doi`, `Abstract`, `Keywords`): `$labels.*$` written into meta by `modules/authors.lua:854-913` (`computeLabels`). Templates: `title-metadata.html:3,4,32,43,52,61,74,83`, `manuscript/title-metadata.html:6,7,37,48,57,66,83,92`.
- **Crossref text** (`Figure 1.1`, `Table 2.1`): assembled in Lua by `crossref/format.lua` using `title()` / `refPrefix()` which call `param("crossref-<type>-title"/"-prefix")`. Written as inline text directly into the AST. By the time Pandoc renders HTML, the localized prefix is already document content.
- **Callout titles** (`Tip`, `Note`, etc.): `modules/callouts.lua:15,185` reads `param("callout-<type>-title", default)`, writes into the callout node.
- **DOM-level UI strings** (search, listings, related formats, code tools, etc.): TS surface (2c) writes into the DOM in HTML postprocessors.

### 3b. LaTeX / PDF

Three localization paths layered:

1. **babel (Pandoc-native)** — `_language-<lang>.yml` not involved. Pandoc converts `lang:` into `$babel-lang$` and friends; `pdf/pandoc/babel-lang.tex:4-23` injects `\usepackage{babel}` with the right option; `babel` then automatically localizes `\chaptername`, `\figurename`, `\tablename`, `\contentsname`, `\listfigurename`, `\listtablename`, `\proofname`. These are "free" — no Quarto code touches them.

2. **Lua-injected `\renewcommand` overrides** — `crossref/meta.lua:32-43` calls `metaInjectLatex` (defined at `common/meta.lua:51-59`, format-gated to LaTeX), which appends raw TeX to `header-includes`. Uses `maybeRenewCommand` (`crossref/meta.lua:93-95`) which emits `\ifdefined\<cmd>\renewcommand*\<cmd>{arg}\else\newcommand\<cmd>{arg}\fi`. This deliberately overrides babel's defaults with the Quarto-side crossref title (so user can override e.g. `figurename` via crossref options). Overridden commands: `contentsname`, `listfigurename`, `listtablename`, `figurename`, `tablename`. `crossref/theorems.lua:217` does the same for `\proofname` via raw `\renewcommand` inside `\AtBeginDocument`.

   Other Lua filters use `metaInjectLatex` for non-language LaTeX customization (`crossref/custom.lua:78`, `layout/meta.lua`, `quarto-post/landscape.lua`, etc. — they inject packages or styling, not localized strings).

3. **Pandoc template `$var$`** — `pdf/pandoc/toc.tex:3` and `pdf/pandoc/latex.template:93-94` use `$toc-title$` to set `\contentsname`. Beamer templates (`beamer/pandoc/beamer.template:146-151`, `beamer/pandoc/toc.tex:3`) likewise.

PDF-side TS code does not read `format.language` directly except `src/format/pdf/format-pdf.ts:242` which registers `"babel-lang"` as a Quarto partial.

### 3c. Typst

Localization paths:

1. **Typst native (`set text(lang: ...)`)** — `lang:` flows as Pandoc metadata, `$lang$` resolves to `lang: "fr"` in `typst-show.typ:22-24`, then `typst-template.typ:45-47` applies `set text(lang: lang, region: region, size: fontsize)`. Typst then auto-localizes its built-in figure/table/equation/listing/appendix/bibliography/outline strings using its own translation tables. Like babel for LaTeX, Quarto does not control these — they come for free from Typst.

2. **Pandoc template `$var$` via meta** — same channel as HTML.
   - `$toc-title$` (resolved via 2b in `pandoc.ts:498`) used in `typst-show.typ:93-95` as `toc_title:`.
   - `$labels.abstract$` (written by `authors.lua` `computeLabels`) used in `typst-show.typ:30` as `abstract-title:`.
   For orange-book (`src/resources/extension-subtrees/orange-book/_extensions/orange-book/typst-show.typ`): the template uses `$quarto.language.crossref-lof-title$`, `$quarto.language.crossref-lot-title$`, and `$quarto.language.crossref-ch-prefix$` (via channel 2d above) to set `list-of-figure-title`, `list-of-table-title`, and `supplement-chapter` parameters on `book.with(...)`. The values reach the template via the defaults-file `variables:` section, so they never leak into the markdown YAML header of intermediate outputs. (The migration of orange-book's `typst-show.typ` to the `$quarto.language.*$` form ships with the issue tracked at GitHub #14524 — keep an eye on it if you are editing this extension.)

3. **Lua-injected supplements for refs** — `crossref/refs.lua:89-91` wraps every `@fig-foo`-style reference into `#ref(<label>, supplement: [<prefix>])` raw Typst. The supplement string comes from `param("crossref-<type>-prefix")` via `refPrefix()` in `crossref/format.lua:68`. This overrides Typst's native ref supplement so the language matches Quarto's localization.

4. **Lua-injected meta for layout** — `layout/meta.lua:169-196` writes Typst-specific meta keys like `margin-geometry` (consumed by orange-book typst-show.typ).

Subtle: figure CAPTIONS (`Figure 1: caption`) use Typst native localization (path 1). Figure REFERENCES (`@fig-foo` → `Figure 1`) use Quarto-injected supplement (path 3). The prefix word is the same in most languages, but they go through different code paths.

## 4. Adding a new localized string

Pick the channel that matches your consumer:

| Consumer | Channel | Touch points |
|----------|---------|--------------|
| Lua filter logic, AST text injection | 2a | New `kLanguageDefaultsKeys` constant. Optionally extend `languageFilterParams` if the prefix is unusual. Read in Lua via `param()`. |
| Built-in Pandoc template `$var$` (single scalar, flat) | 2b (TS) | Add copy block in `pandoc.ts` near `kTocTitle`. Pattern: `metadata[k] = metadata[k] || language[k];`. Use this only when changing the template is not an option; otherwise prefer 2d. |
| Pandoc template `$quarto.language.<key>$` (any template, any format) | **2d** | No code change beyond adding the key to `_language.yml` and the schema — `buildQuartoTemplateVariables` exposes the whole `format.language` table. Templates read `$quarto.language.<key>$`. |
| New Pandoc template variable under a fresh `$quarto.<area>.<key>$` form (not language) | **2d** | Add a field to `QuartoTemplateVariables` and a contribution branch to `buildQuartoTemplateVariables` in `src/command/render/quarto-template-variables.ts`. Templates read `$quarto.<area>.<key>$`. |
| HTML DOM / front-end JSON | 2c | Add `format.language[key]` read in the appropriate `format-html-*.ts` postprocessor. |
| LaTeX command override | 3b path 2 | Add `maybeRenewCommand("<cmd>", localized-value)` inside the existing `metaInjectLatex` block in `crossref/meta.lua`. |

Steps for every new key:

1. Add to `src/resources/language/_language.yml` (English default) and ideally to the major translations.
2. Add to `format-language` in `src/resources/schema/definitions.yml`.
3. Add `kFoo` constant in `src/config/constants.ts` and to `kLanguageDefaultsKeys`.
4. Wire to consumer via the channel above.
5. Add a smoke-all test in `tests/docs/smoke-all/` that renders with a non-English `lang:` and asserts the translation appears in the intermediate output (`.typ`, `.tex`, or rendered HTML). Example: `tests/docs/smoke-all/typst/orange-book-lang/`.

## 5. Common pitfalls

- **Prefer channel 2d for any new key with a Pandoc-template consumer.** Channels 2b (TS or Lua) copy individual keys into `format.metadata`, where writers with `+yaml_metadata_block` then serialize them into the rendered YAML header. Channel 2d (defaults-file `variables.quarto.language.<key>`) avoids that entirely. The pre-existing 2b-TS copies of `toc-title` and `abstract-title` are kept only for backwards compatibility with built-in templates that already read the flat `$toc-title$` and `$abstract-title$` keys.
- **Writing a `$var$` reference in a Pandoc template does not auto-populate the variable.** Pandoc templates resolve against either `format.metadata` (the YAML metadata, channel 2b) or the defaults-file `variables:` section (channel 2d). Existing template-only pipes that lack either wiring silently resolve to empty. Prefer channel 2d for new keys.
- **`param("foo")` in a Pandoc template will not work.** Templates have no access to filter params. Only Lua filters do.
- **Don't conflate `format.language[k]` and `format.metadata[k]`.** First is the resolved translation table; second is Pandoc YAML metadata. Lua filter params bridge the first into Lua; explicit copies in `pandoc.ts` bridge the first into the second.
- **Guard meta writes with `if meta[k] == nil` / `||`.** User-provided metadata or extension defaults must win over the auto-injected localized fallback.
- **Format-native localization (babel, Typst) overlaps Quarto's localization.** For LaTeX `\figurename` etc., babel sets these; Quarto's `\renewcommand` deliberately overrides — so user customization via crossref options reaches LaTeX. For Typst figure captions, Typst's own translation table wins; Quarto only overrides the ref `supplement:` argument.
- **Adding to `languageFilterParams` is rarely needed.** The bulk `startsWith("crossref-"|"callout-"|"environment-")` clause already exposes most new keys to Lua. Only special-purpose keys (like the `crossref-<type>-prefix = crossref-<type>-title` aliasing) belong in the explicit block.
- **`languageFilterParams` does not write to `format.metadata` or `variables:`.** It only populates filter params. If your template needs the value, use channel 2d (preferred) or 2b.
- **`crossref:` block vs `language:` block are different user-facing surfaces.** Per the [Quarto crossref options docs](https://quarto.org/docs/authoring/cross-reference-options.llms.md) and `src/resources/schema/document-crossref.yml`, the `crossref:` YAML block accepts per-document override of common crossref strings — `fig-title`, `fig-prefix`, `sec-prefix`, `lof-title`, `lst-prefix`, theorem family, etc. Translations / locale overrides for ALL localized strings (including those NOT in the crossref schema) go in the `language:` block instead, using the flat `crossref-*` key form (e.g., `language: { crossref-ch-prefix: "Chapitre" }`).

  Deliberately NOT in the `crossref:` schema: `ch-prefix`, `apx-prefix`, `pt-prefix`. These are language-only keys — book-structure terms that ride the locale rather than per-document tweaks. `crossref/format.lua:refPrefix()` only handles types that have a documented `crossref.<type>-prefix` form; `ch` / `apx` / `pt` are never passed in (chapter/appendix headings use a different code path — `book-chapters.ts:149` for HTML appendix, babel `\chaptername` for LaTeX, `$crossref-ch-prefix$` from meta for Typst extensions).

- **Pandoc templates for keys that have BOTH user-config and language forms** (e.g., `lof-title`) should probe both via `$if(crossref.foo)$$crossref.foo$$else$$quarto.language.crossref-foo$$endif$` — user-set `crossref:` block values take precedence; the `$quarto.language.*$` form (channel 2d) provides the localized fallback.

- **For keys that are language-only** (e.g., `ch-prefix`), the template should NOT use the `$crossref.foo$` form because it is unreachable — schema rejects user input and no code writes to `meta.crossref.foo`. Use `$quarto.language.crossref-foo$` directly (channel 2d). The orange-book `supplement-chapter` pipe uses this minimal form.
