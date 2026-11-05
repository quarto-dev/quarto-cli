# Fill Missing Keys with Reviewed Machine Translation

The procedure used for the per-key translation PRs of #14822, applied to one language. Goal: commit only values two independent reviewers accept; everything else stays a known gap for a native speaker.

## 1. Gather context per key

For each missing key, collect:

- The translator note above it in `_language.yml` (sense of ambiguous words, verb or noun, singular or plural, visible text or screen-reader only, rules such as "no word for navigation").
- Related strings from the target file that set vocabulary and grammatical form: for buttons, the file's `search-clear-button-title`, `search-detached-cancel-button-title`, `tools-share`; for links, `back-to-top`, `repo-action-links-edit`; for landmarks, `toggle-navigation`, `crossref-sec-prefix`, `toc-title-website`; for code labels, `code-summary`.

Keys sharing one note (the five `navigation-*-label`, the two `scrollable-*-label`) go in one batch with one context.

## 2. Translate

One `mcp__lara-translate__translate` call per batch, `source: en-US`, `target: <code>`, `no_trace: true`, and a `context` written from step 1 that names the use, the rule, and two or three of the file's related strings with their English. Per-key context, not blanket `instructions`: a blanket instruction over-applies (it turned "Slide menu" into "Open the slide menu" in some languages).

The Lara free tier is 10,000 characters a month; one language's missing keys are a few hundred.

## 3. Review blind

Write one self-contained prompt: every key with its English value, use and rule; the file's related strings; the translated values as a table. Ask for exactly one line per key:

```
K# OK|FLAG <confidence high|medium|low> <if FLAG: short reason and one better candidate>
```

Tell the reviewer to flag a wrong meaning for the use, a broken rule, a grammatical form inconsistent with the file's existing strings (imperative verb vs verbal noun is the common one), and keys built inconsistently with their siblings; and to leave acceptable synonyms alone.

Run it through two reviewers that cannot see each other's output, for example `codex exec -s read-only --skip-git-repo-check -o verdict.txt - < prompt.md` and a fresh subagent told to read only the prompt file.

## 4. Apply the confidence rule

- Both reviewers OK → commit the translated value.
- Both FLAG with the same candidate → commit the candidate.
- Anything else → the value stays out; add the (key, language) pair to `tests/unit/language-known-gaps.yml` and list the candidates and the reason in the PR comment, asking a native speaker to pick.

A second MT engine agreeing is not a confidence signal: Google Translate repeated Lara's errors in the #14822 spike.

## 5. Record

Insert committed values in `_language.yml` key order. The PR comment gets a table of every value added this way and states they are AI-generated, translated with the translator notes and checked by two independent AI reviewers. Ask any native speaker already on the thread to look at them.
