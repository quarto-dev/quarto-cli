---
title: "Here we go boys"
author: "J.J. Allaire"
knit: quarto render
format:
  html:
    keep-md: true
    self-contained: false
    fig-width: 8
    fig-height: 2
execute:
  include-code: false
  include-warnings: true
bibliography: references.bib
jupyter:
  jupytext:
    formats: ipynb,md
    text_representation:
      extension: .md
      format_name: markdown
      format_version: '1.2'
      jupytext_version: 1.6.0
  kernelspec:
    display_name: Python 3
    language: python
    name: python3
---

```python tags=["remove-cell"]
import os
import warnings
```


```python class="foo bar" tags=["include-code", "allow-errors", "raises-exception"]
print("here we go again")
warnings.warn("we better watch out!")
```


## Leaflet

```python tags=["no-execute"]
from ipyleaflet import Map, Marker, basemaps, basemap_to_tiles
m = Map(
    basemap=basemap_to_tiles(basemaps.NASAGIBS.ModisTerraTrueColorCR, "2017-04-08"),
    center=(52.204793, 360.121558),
    zoom=4
)
m.add_layer(Marker(location=(52.204793, 360.121558)))
m
```


## Visual Editor

@pirzada2020

## iTables

```python
import itables.interactive
import world_bank_data as wb

df = wb.get_countries()
df
```

## Plotly FTW

```python tags=["no-execute"]
import plotly.graph_objects as go
fig = go.Figure(
    data=[go.Bar(y=[2, 1, 3])],
    layout_title_text="A Figure Displayed with fig.show()"
)
fig.show()
```

## Slide with Plot

```python class=".rich .internet .output" foo="bar" id="myplot" tags=["include-code"]
import matplotlib.pyplot as plt
from IPython.display import set_matplotlib_formats
import inspect

plt.rcParams['figure.figsize'] = 10, 2
set_matplotlib_formats('pdf')

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


## Next Slide

```python
from jupytext.config import find_jupytext_configuration_file
find_jupytext_configuration_file('.')
```


