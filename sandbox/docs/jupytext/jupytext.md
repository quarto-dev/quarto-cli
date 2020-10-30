---
title: "Here we go again and again"
author: "J.J. Allaire"
knit: quarto render
format:
  html:
    keep-md: false
execute:
  include-code: true
  allow-errors: true
bibliography: references.bib
jupyter:
  jupytext:
    formats: ipynb,md
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python tags=["remove-cell"]
import warnings
```


```python
import os
print(os.getcwd())
print ("Hello, World Again and Again\n")
warnings.warn("we better watch out!")
```


## Visual Editor

@pirzada2020

Definition is the tip

: Here we go

```python tags=["include-code"]
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


```python
from jupytext.config import find_jupytext_configuration_file
find_jupytext_configuration_file('.')
```


