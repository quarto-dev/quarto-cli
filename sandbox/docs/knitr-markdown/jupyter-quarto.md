---
format:
  markdown:
    output-file: jupyter-quarto.md
knit: quarto render
title: Jupyter
---

## Text

::: {.cell .code}
``` {.python}
print(1 + 1)
```

::: {.output .stream .stdout}
    2
:::
:::

## Warning

::: {.cell .code}
``` {.python}
from warnings import warn
warn("Be warned!")
```

::: {.output .stream .stderr}
    UserWarning: Be warned!
      warn("Be warned!")
:::
:::

## Plot

::: {.cell .code}
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
```

::: {.output .display_data}
![](jupyter_files/figure-markdown/cell-4-output-1.png)
:::
:::
