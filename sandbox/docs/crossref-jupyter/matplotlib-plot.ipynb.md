---
title: "MPL slides"
format:
  html: 
    keep-md: true
jupyter: true
---

::: {.cell .code}
```{.python}
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

:::{.output .display_data}
![My figure](matplotlib-plot_files/figure-html/cell-2-output-1.png){width=585 height=424}
:::

:::{.output .stream .stdout}
```
Some console output
```
:::

:::{.output .display_data}
![My other figure](matplotlib-plot_files/figure-html/cell-2-output-3.png){width=585 height=424}
:::
:::

See @fig:scores for more details.

See @fig:scores-1 for more details.

See @fig:scores-2 for more details.










