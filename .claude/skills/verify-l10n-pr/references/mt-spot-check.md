# MT Spot-Check with a Context-Aware Translation Tool

Only relevant if a translation MCP (e.g. `mcp__lara-translate__translate`) is connected. If none is, skip this file — don't try to substitute a plain/free MT API here (see `why-not-libretranslate.md` for why that specifically fails on this content).

## Running it

Batch the changed strings both directions in one call each — `source→target` (back-translation, checked against the base English meaning) and `target→source` (forward, checked against the contributor's actual value). Always set the `context` parameter to describe the domain, e.g.:

> "Short UI labels from a documentation/publishing software's interface (button labels, navigation landmarks, tooltips, accessibility labels)"

Without `context`, short/single-word strings ("Note", "Draft", "Page") lose enough surrounding meaning that even a good MT engine can drift. With it, single-word UI labels translate sensibly.

## Reading the results

Most differences between MT output and the contributor's value are **not errors** — they're normal translator-to-translator variation:

- Register (formal vs. informal imperative, e.g. "open" vs. "please open")
- Loanword vs. native-vocabulary synonym for the same concept (e.g. an international loanword for "copy" vs. a native verb meaning "transfer")
- Paraphrase that preserves the same meaning with different word order or an added/dropped connective word

Only flag something when the MT output and the contributor's value diverge in **meaning**, not just phrasing — and even then, treat it as "worth a second look," not "wrong." Neither you nor the MT tool is a native speaker.

## The false positive you will hit: `navigation-*-label` keys

Quarto's accessibility convention (`src/resources/language/_language.yml:87-96`) requires the five `navigation-*-label` values (site/section/toolbar/page/breadcrumbs landmark labels) to **avoid** the word for "navigation" in that language — screen readers already announce the landmark role, so repeating it is redundant. A plain MT engine doesn't know this rule. Translating "Breadcrumbs" forward without context will often produce something like "navigation path," because that's a perfectly reasonable generic translation — and it will look like a mismatch against a contributor who correctly wrote something like "page path" instead to follow the project's rule.

**Do not flag a `navigation-*-label` mismatch as a translation error without first checking whether the contributor's value avoids the word for "navigation" and the MT suggestion doesn't.** If that's the pattern, the contributor is right and the MT suggestion is the one to discard. The structural check's navigation-landmark heuristic (Step 1) is the more reliable signal for this specific rule — use the MT spot-check to corroborate general meaning, not to police this particular convention.

## Terminology ambiguity vs. genuine error

Sometimes a back-translation reveals that a word the contributor used is genuinely ambiguous in the target language (has two plausible glosses in English, one of which sounds wrong). That's worth a note, but check whether the *forward* translation (context→target) independently landed on the same word — if both directions converge on it, it's likely the standard term in that language for this context, not a mistake, and the back-translation's alternate gloss is just MT picking the less-likely sense of an ambiguous word.
