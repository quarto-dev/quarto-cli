---
title: "matplotlib"
knit: quarto render
format:
  html:
    fig-width: 10
    fig-height: 4
    keep-md: true
---



::: {.cell .code}
```{.python}
import matplotlib.pyplot as plt

labels = ['G1', 'G2', 'G3', 'G4', 'G6']
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
```

::: {.output .display_data }
![my plot](matplotlib_files/figure-html/cell-2-output-1.png){#fig:myplot width=807.5 height=351}
:::
:::

