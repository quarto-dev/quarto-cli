---
title: "Here we go"
format:
  html:
    # standard variables
    toc: true
    toc-depth: 2

    # html specific variables
    fontsize: 14px

    # defaults file (command line args)
    highlight-style: pygments
    html-math-method:
      method: katex
      url: https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.11.1/

    # we'll do this
    r-options:
      width: 80

    # quarto: knitr options (could be nbconvert)
    knitr:
      opts_chunk:
        fig.width: 5
        fig.height: 4

# nbconvert command line options / confile file options
# (note that kntir and nbcovert are mutually exclusive
# for a given soure file)
nbconvert:
  no-prompt: true
  no-input: true
  allow-errors: true

filters:
  - downlit
  - ./caps.py
  - foo.lua
  - type: json
    path: localbin

tinytex:
  min-runs: 1
  max-runs: 8
  output-dir: "latex.out"

crossref:
  cref: false
  chapters-depth: 2
  auto-eqn-labels: true

tools:
  pandoc: 2.11.0.2
  tinytex: 2020.10.2
---

When we process the above, we need to divide into:

1. Quarto fields (known subset)
2. --defaults Default file fields (known subset)
3. --metadata-file (all the rest)

Anything and everything can be format specific (we will merge unknown
keys into the main metadata)

Computation engine and/or the formats, receive a list with:

- Format
- Metadata (resolved for format)

Multiple "instances" of a format are supported via "+"

`_quarto.yml`

- Look in current dir and parent dirs (until project: true)
  and merge `_quarto.yml` into current document.

quarto render --config myconfig.yml (merges _after_ user options)
