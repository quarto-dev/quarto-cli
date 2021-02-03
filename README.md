# Quarto CLI

Quarto is an academic, scientific, and technical publishing system built on [Pandoc](https://pandoc.org).

In addition to the core capabilities of Pandoc, Quarto includes:

1.  Support for integrated output from R and Python via integration with knitr and Jupyter
2.  A project system for rendering groups of documents at once and sharing metadata between them.
3.  Cross references for figures, tables, equations, sections, listings, proofs, and more.
4.  Sophisticated layout for panels of figures, tables, and other content.

Quarto is currently in alpha development, so not generally recommended for everyday use! Documentation on using Quarto will be available soon.

## Installation

You can install an alpha-build of the Quarto command-line tools from here:

<https://github.com/quarto-dev/quarto-cli/releases/tag/v0.1.32>

You can verify that Quarto has been installed correctly with:

``` bash
$ quarto help
```

To install the development version of the Quarto CLI, git clone this repo then run the configure script for your platform (`linux`, `macos`, or `windows`).

``` bash
$ git clone https://github.com/quarto-dev/quarto-cli
$ cd quarto-cli
$ ./configure-macos.sh 
```

## Usage

You can use the `quarto render` command to render plain markdown, R Markdown, or a Jupyter notebook:

``` bash
$ quarto render plain.md
$ quarto render rmarkdown.Rmd
$ quarto render jupyter.ipynb
$ quarto render jupyter.md 
```

Note that the last variation renders a [Jupyter Markdown](https://jupytext.readthedocs.io/en/latest/formats.html#jupytext-markdown) document, which is pure markdown representation of a Jupyter notebook. A markdown file is denoted as Jupyter markdown via the inclusion of a `jupyter` entry in YAML front matter indicating the Jupyter kernel or Jupytext configuration for the document (e.g. `jupyter: python3`).

See `quarto render help` for additional documentation on using the `render` command.

### Formats

Quarto uses Pandoc front-matter to define which format to render and what options to use for that format. For example, this document defines HTML and PDF output (where HTML is the default because it is listed first):

``` yaml
---
title: "My Document"
author: "Jane Doe"
toc: true
toc-depth: 2
format:
  html:
    fontsize: 14
    margin-left: 100px
    margin-right: 100px
    html-math-method: katex
  pdf:
    documentclass: report
    margin-left: 30mm
    margin-right: 30mm
---
```

All pandoc formats (see `pandoc --list-output-formats`) are supported. The YAML metadata provided for each format may include any pandoc [metadata variables](https://pandoc.org/MANUAL.html#variables) or [command-line defaults](https://pandoc.org/MANUAL.html#default-files). All YAML metadata can be provided globally for all formats (as illustrated with `toc` and `toc-depth` above) or on a per-format basis.
