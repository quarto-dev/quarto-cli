---
title: "MPL slides"
format:
  pdf: 
    keep-md: true
---

::: {#fig:scores .cell .cell-code lst.cap="Checkout the scores" lst.label="lst:scores"}
``` {#lst:scores .python caption="Checkout the scores"}
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

print("Some console output")

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
![My figure](matplotlib-plot_files/figure-pdf/fig-scores-output-1.pdf){#fig:scores-1}
:::

::: {.output .stream .stdout}
```
Some console output
```
:::

::: {.output .display_data}
![My other figure](matplotlib-plot_files/figure-pdf/fig-scores-output-3.pdf){#fig:scores-2}
:::
:::


See @fig:scores-1 for more details.

See @fig:scores-2 for more details.










