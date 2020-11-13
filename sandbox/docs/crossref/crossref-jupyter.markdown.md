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
  html:
    keep-md: true
  markdown: default
knit: quarto render
lastDelim: ", "
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
title: MPL slides
titleDelim: ":"
---

## Slide 1

::: {#fig:bar:foo .cell .code}
``` {.python}
import matplotlib.pyplot as plt

labels = ['G1', 'G2', 'G3', 'G4', 'G5']
men_means = [20, 35, 30, 35, 27]
women_means = [25, 32, 34, 20, 25]
men_std = [2, 3, 4, 1, 2]
women_std = [3, 5, 2, 3, 3]
width = 0.35       # the width of the bars: can also be len(x) sequence

fig, ax = plt.subplots()

ax.bar(labels, men_means, width, yerr=men_std, label='Men')
ax.bar(labels, women_means, width, yerr=women_std, bottom=men_means,
       label='Women')

ax.set_ylabel('Scores')
ax.set_title('Scores broken out by group and gender')
ax.legend()
plt.show()

fig, ax = plt.subplots()

ax.bar(labels, men_means, width, yerr=men_std, label='Men')
ax.bar(labels, women_means, width, yerr=women_std, bottom=men_means,
       label='Women')

ax.set_ylabel('Scores')
ax.set_title('Scores broken out by group and gender')
ax.legend()
plt.show()
```

::: {.output .display_data}
![Figure 1:
Caption1](crossref-jupyter_files/figure-markdown/fig-bar-foo-output-1.png){#fig:fig:bar:foo-1}
:::

::: {.output .display_data}
![Figure 2:
Caption2](crossref-jupyter_files/figure-markdown/fig-bar-foo-output-2.png){#fig:fig:bar:foo-2}
:::
:::
