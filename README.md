<!-- -*- mode: gfm -*- -->

# Quarto

Quarto is an open-source scientific and technical publishing system built on [Pandoc](https://pandoc.org). Quarto documents are authored using [markdown](https://en.wikipedia.org/wiki/Markdown), an easy to write plain text format.

In addition to the core capabilities of Pandoc, Quarto includes:

1.  Embedding code and output from Python, R, Julia, and JavaScript via integration with [Jupyter](https://jupyter.org/), [Knitr](https://yihui.org/knitr/), and [Observable](https://github.com/observablehq/).

2.  A variety of extensions to Pandoc markdown useful for technical writing including cross-references, sub-figures, layout panels, hoverable citations and footnotes, callouts, and more.

3.  A project system for rendering groups of documents at once, sharing options across documents, and producing aggregate output like [websites](https://quarto.org/docs/websites/) and [books](https://quarto.org/docs/books/).

4.  Authoring using a wide variety of editors and notebooks including [JupyterLab](https://quarto.org/docs/tools/jupyter-lab.html), [RStudio](https://quarto.org/docs/tools/rstudio.html), and [VS Code](https://quarto.org/docs/tools/vscode.html).

5.  A [visual markdown editor](https://quarto.org/docs/visual-editor/) that provides a productive writing interface for composing long-form documents.

Learn more about Quarto at <https://quarto.org>.

## Development Version

To install the development version of the Quarto CLI, clone the quarto-cli repository then run the configure script for your platform (`configure.sh` for Linux/macOS or `configure.cmd` for Windows). For example:

```bash
git clone https://github.com/quarto-dev/quarto-cli
cd quarto-cli
./configure.sh
```

To update to the latest development version, run `git pull` from the local repo directory:

```bash
cd quarto-cli
git pull
```

## Running Tests

To run all unit tests, execute the script in the test directory.

```bash
cd tests
./run-tests.sh
```

To run a specific unit test, specify the script name.

```bash
cd tests
./run-tests.sh smoke/extensions/extension-render-doc.test.ts
./run-tests.sh smoke/extensions/
```

## License

Quarto is open source software available under the MIT license (<https://opensource.org/license/mit/>).
