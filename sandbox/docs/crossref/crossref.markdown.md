---
ccsDelim: ", "
ccsLabelSep: " --- "
ccsTemplate: $$i$$$$ccsLabelSep$$$$t$$
chapDelim: .
chaptersDepth: 1
crossrefYaml: pandoc-crossref.yaml
eqLabels: arabic
eqnPrefix:
- eq.
- eqns.
eqnPrefixTemplate: $$p$$ $$i$$
figLabels: arabic
figPrefix:
- fig.
- figs.
figPrefixTemplate: $$p$$ $$i$$
figureTemplate: $$figureTitle$$ $$i$$$$titleDelim$$ $$t$$
figureTitle: Figure
format:
  markdown:
    filters:
    - pandoc-crossref
knit: quarto render
lastDelim: ", "
linkReferences: true
listingTemplate: $$listingTitle$$ $$i$$$$titleDelim$$ $$t$$
listingTitle: Listing
lofTitle: |
  # List of Figures
lolTitle: |
  # List of Listings
lotTitle: |
  # List of Tables
lstLabels: arabic
lstPrefix:
- lst.
- lsts.
lstPrefixTemplate: $$p$$ $$i$$
nameInLink: true
pairDelim: ", "
rangeDelim: "-"
refDelim: ", "
refIndexTemplate: $$i$$$$suf$$
secHeaderDelim: 
secHeaderTemplate: $$i$$$$secHeaderDelim$$$$t$$
secLabels: arabic
secPrefix:
- sec.
- secs.
secPrefixTemplate: $$p$$ $$i$$
sectionsDepth: 0
subfigLabels: alpha a
subfigureChildTemplate: $$i$$
subfigureRefIndexTemplate: $$i$$$$suf$$ ($$s$$)
subfigureTemplate: $$figureTitle$$ $$i$$$$titleDelim$$ $$t$$. $$ccs$$
tableTemplate: $$tableTitle$$ $$i$$$$titleDelim$$ $$t$$
tableTitle: Table
tblLabels: arabic
tblPrefix:
- tbl.
- tbls.
tblPrefixTemplate: $$p$$ $$i$$
title: Test crossrefs
titleDelim: ":"
---

## Image

![Figure 1: Caption](file.jpg){#fig:label width="100" height="100"}

## Math

[$$ 
math 
\qquad(1)$$]{#eq:label}

## Table

::: {#tbl:label}
  Col1   Col2   Col3
  ------ ------ ------
  a             
                
                c

  : Table 1: This is the caption
:::

## Section {#sec:section}

This is a section

See [fig. 1](#fig:label) for more.

See [eq. 1](#eq:label) for an eqution.

See [tbl. 1](#tbl:label) for a table.

See section [sec. 1.4](#sec:section).
