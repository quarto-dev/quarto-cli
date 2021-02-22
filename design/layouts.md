---
title: "Woozy Foobar"
---

3 separate and entirely unrelated sets of functionality:

1. Quarto-pre: Convert linked figures to figure divs

2. Cross references

3. Layout panels

4. Quarto-post: Figure alignment

::: {layout=[5,4,5] layout.rows=1 layout.cols=1, layout.align="center"}

- Collect all blocks into the layout; however
  - CodeBlock.cell-code is pulled out (computational input)
  - Headers are rolled into the next block

- Will need to wrap everything in a div (so it can carry attributes e.g. width).
  It can also have a fake caption if need be. Note paragraphs with images in
  them are fine.

- For #fig: or #tab: layouts use the figure and table environments, and can have
  a captoin. Layouts without #fig or #tab will use a new custom Latex float type

  (https://en.wikibooks.org/wiki/LaTeX/Floats,_Figures_and_Captions#Custom_floats)
  and _do not have captions_

  \begin{figure} and \begin{table} are specific to figures and tables (others
  will use \begin{layout} a custom float that we create) Captions are specific
  to figures and tables

:::

::: {layout.cols=2}

![](image.png)

::: analysis asdf adsf dsa f.

adsf asdfadsfsasd.

:::

:::

::: {layout.cols=2}

## Pros

- asdfadsf
- adsfasdf
- adfasdf

## Cons

- asdfadsf
- adsfasdf
- adfasdf

:::
