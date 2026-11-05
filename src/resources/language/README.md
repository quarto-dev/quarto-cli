## Quarto Localization

In some circumstances Quarto, Pandoc, and LaTeX will generate textual output that requires localization. For example, "Figure" or "List of Figures" for cross references, callout types like "Note" or "Warning", or the "Code" caption for folded code chunks.

This directory includes a set of built-in translations, including:

| File                    | Language                               |
| ----------------------- | -------------------------------------- |
| `_language.yml`         | English (default)                      |
| `_language-ar.yml`      | Arabic                                 |
| `_language-az.yml`      | Azerbaijani                            |
| `_language-eu.yml`      | Basque                                 |
| `_language-pt-BR.yml`   | Brazilian Portuguese (overlay)         |
| `_language-bg.yml`      | Bulgarian                              |
| `_language-fr-CA.yml`   | Canadian French (overlay)              |
| `_language-ca.yml`      | Catalan                                |
| `_language-zh.yml`      | Chinese                                |
| `_language-cs.yml`      | Czech                                  |
| `_language-da.yml`      | Danish                                 |
| `_language-nl.yml`      | Dutch                                  |
| `_language-fi.yml`      | Finnish                                |
| `_language-fr.yml`      | French                                 |
| `_language-de.yml`      | German                                 |
| `_language-el.yml`      | Greek                                  |
| `_language-he.yml`      | Hebrew                                 |
| `_language-is.yml`      | Icelandic                              |
| `_language-id.yml`      | Indonesian                             |
| `_language-it.yml`      | Italian                                |
| `_language-ja.yml`      | Japanese                               |
| `_language-ko.yml`      | Korean                                 |
| `_language-lt.yml`      | Lithuanian                             |
| `_language-nb.yml`      | Norwegian Bokmål                       |
| `_language-nn.yml`      | Norwegian Nynorsk                      |
| `_language-pl.yml`      | Polish                                 |
| `_language-pt.yml`      | Portuguese                             |
| `_language-ru.yml`      | Russian                                |
| `_language-sr-Latn.yml` | Serbian (Latin script)                 |
| `_language-sk.yml`      | Slovak                                 |
| `_language-sl.yml`      | Slovenian                              |
| `_language-es.yml`      | Spanish                                |
| `_language-sv.yml`      | Swedish                                |
| `_language-de-CH.yml`   | Swiss German (overlay)                 |
| `_language-zh-TW.yml`   | Traditional Chinese (Taiwan) (overlay) |
| `_language-tr.yml`      | Turkish                                |
| `_language-ua.yml`      | Ukrainian                              |

The use of these translations is triggered by the [`lang`](https://pandoc.org/MANUAL.html#language-variables) Pandoc metadata variable, which identifies the main language of the document using IETF language tags (following the [BCP 47](https://tools.ietf.org/html/bcp47) standard), such as `en` or `en-GB`. The [Language subtag lookup](https://r12a.github.io/app-subtags/) tool can look up or verify these tags.

For example, this document will use the built-in French translation file by default:

```yaml
---
title: "My Document"
lang: fr
---
```

## Contributing Localizations

We welcome translations for new languages and for missing strings in existing languages! To contribute a localization:

1.  For a new language, make a copy of the `_language.yml` file with the appropriate IETF language tag appended to the filename (e.g. `_language-fr.yml`).

2.  Translate the English strings into the target language. Before translating a key, read its translator comment in `_language.yml`. Some strings are screen-reader labels or use words in a specific sense, as the comments explain.

3.  Reuse the vocabulary and verb forms already used in your language file so the interface stays consistent.

4.  Keep the `{0}`-style placeholders exactly as they appear in the English value.

5.  Submit a [pull request](https://help.github.com/articles/using-pull-requests) with your translation.

A few more things to know:

- **Region files are overlays.** `de-CH`, `fr-CA`, `pt-BR` and `zh-TW` are read on top of `de`, `fr`, `pt` and `zh`, so they only need the keys that differ from their base language.
- **AI help is welcome.** Check the translation against the translator comments and existing strings in the language file, and mention in the pull request that you used AI.
- **Checking your file.** `tests/unit/language-parity.test.ts` fails if a language file has a key that is not in `_language.yml`, misses a key, or changes the placeholders. If you add an English key that you cannot translate, add its language entries to `tests/unit/language-known-gaps.yml` instead.
