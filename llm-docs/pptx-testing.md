---
main_commit: 38e34ec50
analyzed_date: 2026-11-09
key_files:
  - tests/verify.ts
  - tests/smoke/smoke-all.test.ts
  - tests/docs/smoke-all/pptx/bullets-table-bullets-one-slide.qmd
---

# Testing PowerPoint (pptx) output

pptx is tested through smoke-all documents (`tests/docs/smoke-all/`), with the verifiers `ensurePptxXpath`, `ensurePptxLayout`, `ensurePptxMaxSlides` and `ensurePptxRegexMatches` in `tests/verify.ts`. Few tests exist; for one worth copying see `tests/docs/smoke-all/pptx/bullets-table-bullets-one-slide.qmd`.

## How a verifier reads the deck

`withPptxContent` (`tests/verify.ts`) copies the `.pptx`, unzips it, and reads `ppt/slides/slide<N>.xml` (or its `_rels/slide<N>.xml.rels` for layouts). Everything is per slide number.

- **Slide 1 is the generated title slide** whenever the document has a `title` (and `author`/`date`). The first slide made from a `##` heading is slide 2.
- **Text before the first heading becomes its own slide.** Put the scenario explanation of a test in an HTML comment, not in body prose, or the slide count changes.

## Verifier arguments in `_quarto: tests: pptx:`

| Key | Value | Notes |
|---|---|---|
| `ensurePptxMaxSlides` | `- N` | Fails if slide N+1 exists. A ceiling, not an exact count. Also fails if slide N is missing. |
| `ensurePptxLayout` | `- [N, "Layout name"]`, one entry per slide | Layout name is the `p:cSld/@name` of the slide's layout. |
| `ensurePptxXpath` | `- [N, [must-match xpaths], [must-not-match xpaths]]` | Namespaces such as `a:` and `p:` are available, e.g. `//a:tbl`. |
| `ensurePptxRegexMatches` | `- [regexes]` then `- N` | Regexes run on the raw slide XML. Slide number is the second item, after the regex list. |

Pass a list of lists to check several slides with `ensurePptxLayout` or `ensurePptxXpath`; a single `[N, ...]` entry also works.

## Layouts come from Pandoc

Pandoc's pptx writer chooses the layout (Title Slide, Section Header, Two Content, Comparison, Content with Caption, Blank, Title and Content) from the slide content, using the layouts of its default `reference-doc`. A Pandoc upgrade can change both the choice and the slide splitting, so layout and slide-count assertions are characterization tests of the bundled Pandoc, not of Quarto code. Say so in the test comment, and re-check them on each Pandoc bump.

Pandoc 3.13 example: text followed by a table gets "Title and Content" where Pandoc 3.10 chose "Content with Caption", and a bullet list, a table and another bullet list stay on one slide.

## Comparing against another Pandoc version

To show that a pptx test depends on the Pandoc version, run it with `QUARTO_PANDOC` set to the `bin/tools/pandoc` of an installed Quarto release (see the `qvm` skill), then run it again without. `QUARTO_<BINARY>` overrides any bundled tool path.

## Inspecting a deck by hand

```bash
quarto render doc.qmd --to pptx
mkdir x && cd x && unzip -q ../doc.pptx
ls ppt/slides/*.xml                         # slide count
cat ppt/slides/_rels/slide2.xml.rels        # which slideLayout<N>.xml
grep -o '<p:cSld name="[^"]*"' ppt/slideLayouts/slideLayout2.xml
```
