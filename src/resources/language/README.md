## Quarto Localization

In some circumstances Quarto, Pandoc, and LaTeX will generate textual output that requires localization. For example, "Figure" or "List of Figures" for cross references, callout types like "Note" or "Warning", or the "Code" caption for folded code chunks.

This directory includes a set of built-in translations, including:

| File               | Language          |
| ------------------ | ----------------- |
| `_language.yml`    | English (default) |
| `_language-zh.yml` | Chinese           |
| `_language-es.yml` | Spanish           |
| `_language-fi.yml` | Finnish           |
| `_language-fr.yml` | French            |
| `_language-ja.yml` | Japanese          |
| `_language-de.yml` | German            |
| `_language-pt.yml` | Portuguese        |
| `_language-ru.yml` | Russian           |
| `_language-tr.yml` | Turkish           |
| `_language-cs.yml` | Czech             |
| `_language-nl.yml` | Dutch             |
| `_language-pl.yml` | Polish            |
| `_language-it.yml` | Italian           |
| `_language-kr.yml` | Korean            |

The use of these translations is triggered by the [`lang`](https://pandoc.org/MANUAL.html#language-variables) Pandoc metadata variable, which identifies the main language of the document using IETF language tags (following the [BCP 47](https://tools.ietf.org/html/bcp47) standard), such as `en` or `en-GB`. The [Language subtag lookup](https://r12a.github.io/app-subtags/) tool can look up or verify these tags.

For example, this document will use the built-in French translation file by default:

```yaml
---
title: "My Document"
lang: fr
---
```

## Contributing Localizations

We welcome contributions of additional languages! To contribute a localization:

1.  Make a copy of the `_language.yml` file with the appropriate IETF language tag appended to the filename (e.g. `_language-fr.yml`).

2.  Translate the English strings therein to the target language.

3.  Submit a [pull request](https://help.github.com/articles/using-pull-requests) with your new language translation. Before doing this please ensure that you have signed the [individual](https://posit.co/wp-content/uploads/2023/04/2023-03-13_TC_Indiv_contrib_agreement.pdf) or [corporate](https://posit.co/wp-content/uploads/2023/04/2023-03-13_TC_Corp_contrib_agreement.pdf) contributor agreement as appropriate. You can send the signed copy to [jj\@rstudio.com](mailto:jj@rstudio.com).
