# Contributing to Quarto

We welcome contributions to Quarto!

You can contribute in many ways:

- By opening issues to provide feedback and share ideas.
- By fixing typos in documentation
- By submitting Pull Request (PR) to fix opened issues
- By submitting Pull Request (PR) to suggest new features (it is considered good practice to open an issue for discussion before working on a pull request for a new feature).

## Opening an issue

Before opening an issue, please search [existing issues](https://github.com/quarto-dev/quarto-cli/issues) to avoid duplicates.

When reporting a bug, include a minimal reproducible example. For feature requests, describe the use case and expected behavior.

### Using AI tools to investigate

If you are using an AI assistant to help investigate a bug or prepare an issue, point it to the Quarto codebase before asking it to analyze the problem:

- **[DeepWiki](https://deepwiki.com/quarto-dev/quarto-cli)** — AI-indexed documentation for the repository. Available as a web UI for human queries and as an [MCP server](https://docs.devin.ai/work-with-devin/deepwiki-mcp) to give your AI assistant direct access. Useful for understanding architecture, finding relevant source files, and asking questions about how Quarto works internally.
- **[Context7](https://context7.com)** — Provides up-to-date Quarto documentation and related tool docs. Available as a web UI, a [cli tool](https://context7.com/docs/clients/cli) and as an [MCP server](https://context7.com/docs/resources/all-clients) so AI assistants can fetch current docs on demand.
- **`https://quarto.org/llms.txt`** — Machine-readable index of Quarto documentation, following the [llms.txt convention](https://llmstxt.org/). Point your AI assistant at this URL to give it a structured map of available documentation.
- **Clone the repo** — AI tools that can run code or search files benefit from a local clone. Cloning the repository lets the AI search source files, trace code paths, and verify behavior directly rather than relying on potentially outdated training data.

Grounding your AI assistant in the actual codebase leads to more accurate root cause analysis and better-quality issue reports.

## To submit a contribution using a Pull Request

1.  [Fork](https://github.com/quarto-dev/quarto-cli/fork) the repository, clone it locally, and make your changes in a new branch specific to the PR. For example:

    ```bash
    # clone your fork
    $ git clone https://github.com/<username>/quarto-cli

    # configure for your platform (./configure.sh for linux/mac  or ./configure.cmd for Windows)
    $ cd quarto-cli
    $ ./configure.sh

    # checkout a new branch
    $ git checkout -b bugfix/myfix
    ```

2.  Submit the [pull request](https://help.github.com/articles/using-pull-requests). It is ok to submit as a draft if you are still working on it but would like some feedback from us. It is always good to share in the open that you are working on it.

We'll try to be as responsive as possible in reviewing and accepting pull requests. Very much appreciate your contributions!
