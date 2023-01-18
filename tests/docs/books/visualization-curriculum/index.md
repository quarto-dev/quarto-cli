# Introduction {.unnumbered}

A data visualization curriculum of interactive notebooks, using [Vega-Lite](https://vega.github.io/vega-lite/) and [Altair](https://altair-viz.github.io/). This book contains a series of Python-based Jupyter notebooks, a corresponding set of JavaScript notebooks are available online on [Observable](https://observablehq.com/@uwdata/data-visualization-curriculum).

::: {.callout-note appearance="simple"}
This book was originally created using [Jupyter Book](https://jupyterbook.org/) and published at <https://uwdata.github.io/visualization-curriculum/>. This site is a port of the original book source to the [Quarto](https://quarto.org) publishing system in order to provide an example of it's use.
:::

## Getting Started

The visualization curriculum can be used either online or on your local computer. You can view and interact with the plots directly in this Jupyter Book. If you want to modify the code, you have a few different options:

- To read JavaScript notebooks online using [Observable](https://observablehq.com/), navigate to the "Observable" page above and click the corresponding notebook.
- To read Python notebooks online using [Colab](https://colab.research.google.com/), click the corresponding section in this book, hover over the little rocket ship at the top of the page, and select "Colab" from the menu.
- To read Python notebooks locally, follow the instructions below.

### Local Installation

1. [Install Altair and a notebook environment](https://altair-viz.github.io/getting_started/installation.html). The most recent versions of these notebooks use _Altair version 4_.
2. Download the notebooks from the [releases page](https://github.com/uwdata/visualization-curriculum/releases). Typically you will want to use the most recent release.  (If you wish to use notebooks for Altair version 3, download the [Altair v3.2 release](https://github.com/uwdata/visualization-curriculum/releases/tag/altair-v3).)
3. Open the notebooks in your local notebook environment. For example, if you have JupyterLab installed (v1.0 or higher is required), run `jupyter lab` within the directory containing the notebooks.

Depending on your programming environment (and whether or not you have a live internet connection), you may want to specify a particular [renderer](https://altair-viz.github.io/user_guide/display_frontends.html) for Altair.

## Credits

Developed at the University of Washington by Jeffrey Heer, Dominik Moritz, Jake VanderPlas, and Brock Craft. Thanks to the [UW Interactive Data Lab](https://idl.cs.washington.edu/) and Arvind Satyanarayan for their valuable input and feedback! Thanks also to the students of [UW CSE512 Spring 2019](https://courses.cs.washington.edu/courses/cse512/19sp/), the first group to use these notebooks within an integrated course curriculum.
