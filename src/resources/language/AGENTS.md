# Language files

Before editing any `_language-*.yml`:

- Read `README.md` in this directory.
- Read the translator comment above each key you translate in `_language.yml`. Some strings are screen-reader labels or use words in a specific sense.
- Keep the `{0}`-style placeholders exactly as they appear in the English value.
- Reuse the vocabulary and verb forms already in the target file.
- Region files (`de-CH`, `fr-CA`, `pt-BR`, `zh-TW`) are overlays: only add keys that differ from the base language.
- Run `unit/language-parity.test.ts` (see `.claude/rules/testing/overview.md`); an English key you cannot translate goes in `tests/unit/language-known-gaps.yml`.
