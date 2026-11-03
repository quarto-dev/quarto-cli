All changes included in 1.12:

## Formats

### `pdf`

- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics. Their body is now upright, like definitions, examples and exercises. (author: @mcanouil)

### `typst`

- ([#15168](https://github.com/quarto-dev/quarto-cli/issues/15168)): Fix definitions, examples and exercises being set in italics in Typst output with the default `theorem-appearance: simple`. Their body is now upright, as in LaTeX output, while theorems, lemmas, corollaries, propositions and conjectures keep an italic body. (author: @mcanouil)
- ([#15251](https://github.com/quarto-dev/quarto-cli/pull/15251)): Fix algorithm blocks (`#alg-`) being set in italics with `theorem-appearance: simple` and using the colours of theorems with `theorem-appearance: fancy`. They now look like definitions, examples and exercises. (author: @mcanouil)

## Projects

### `website`

- ([#12276](https://github.com/quarto-dev/quarto-cli/discussions/12276)): Fix listing `image-alt` values containing quotes or `&` rendering broken or double-escaped alt text. (author: @mcanouil)

## Commands

### `quarto preview`

- ([#14783](https://github.com/quarto-dev/quarto-cli/issues/14783)): Fix `quarto preview` ignoring project metadata contributed by an extension, such as `brand`. Contributed project metadata now applies to every command that builds a project context, `quarto inspect` included. (author: @mcanouil)

## Other fixes and improvements

- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): Translate the `tools-share`, `tools-download`, and `skip-to-content` language keys in Greek. (author: @sogav21)
- ([#14822](https://github.com/quarto-dev/quarto-cli/issues/14822)): The Lithuanian search label and the Swedish caution callout title no longer fall back to English.
