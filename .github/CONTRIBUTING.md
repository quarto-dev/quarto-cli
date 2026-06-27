# Contributing to Quarto

We welcome contributions to Quarto!

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
By taking part, you agree to uphold it.

You can contribute in many ways:

- By opening issues to provide feedback and share ideas.
- By fixing typos in documentation.
- By submitting a Pull Request (PR) to fix an open issue.
- By submitting a PR to suggest a new feature.
  It is good practice to open a discussion before working on a PR for a new feature.

## Choosing the right channel

This repository is for the command-line program `quarto`.
Please use the destination that matches your need so we can respond quickly.

| You want to                                                           | Use                                                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Report a bug or unexpected behaviour.                                 | [Bug report issue form](https://github.com/quarto-dev/quarto-cli/issues/new?template=bug_report.yml).             |
| Report an issue on quarto.org or suggest a documentation improvement. | [Documentation issue form](https://github.com/quarto-dev/quarto-cli/issues/new?template=documentation.yml).       |
| Suggest a new or missing feature.                                     | [Feature Requests discussions](https://github.com/quarto-dev/quarto-cli/discussions/categories/feature-requests). |
| Ask for help or ask a usage question.                                 | [Q&A discussions](https://github.com/quarto-dev/quarto-cli/discussions/categories/q-a).                           |
| Share what you built with Quarto.                                     | [Show and Tell discussions](https://github.com/quarto-dev/quarto-cli/discussions/categories/show-and-tell).       |

Some issues belong to other repositories:

- Visual Editor or the Visual Studio Code / Positron extension: <https://github.com/quarto-dev/quarto>.
- RStudio: <https://github.com/rstudio/rstudio>.
- Positron: <https://github.com/posit-dev/positron>.

## Opening an issue

Before opening an issue, please search [existing issues](https://github.com/quarto-dev/quarto-cli/issues) to avoid duplicates.

When reporting a bug, please:

- Check that the issue persists on the [latest pre-release](https://github.com/quarto-dev/quarto-cli/releases).
- Include a minimal, fully reproducible example as a self-contained Quarto document or a link to a Git repository.
- Include the output of `quarto check` so we know which versions you are running.
- Follow the [Bug Reports guide](https://quarto.org/bug-reports.html) to format your report.

The [bug report form](https://github.com/quarto-dev/quarto-cli/issues/new?template=bug_report.yml) shows the syntax for sharing a Quarto document inside an issue.

For documentation issues, add a link to the page you are referring to and a screenshot when relevant using the [Documentation issue form](https://github.com/quarto-dev/quarto-cli/issues/new?template=documentation.yml).

## Starting a discussion

Discussions are the right place for ideas, questions, and showcases.
Before starting one, please search [existing discussions](https://github.com/quarto-dev/quarto-cli/discussions) and add to an existing thread when one already covers your topic.

- [Feature Requests](https://github.com/quarto-dev/quarto-cli/discussions/categories/feature-requests): describe what you want to achieve and why it matters, so we can understand and prioritise it.
- [Q&A](https://github.com/quarto-dev/quarto-cli/discussions/categories/q-a): ask for help, ideally with a complete self-contained reproducible example.
- [Show and Tell](https://github.com/quarto-dev/quarto-cli/discussions/categories/show-and-tell): share a project, a tip, or a use case.

## Using AI tools to investigate

If you are using an AI assistant to help investigate a bug or prepare an issue, point it to the Quarto codebase before asking it to analyze the problem:

- **[DeepWiki](https://deepwiki.com/quarto-dev/quarto-cli)** — AI-indexed documentation for the repository. Available as a web UI for human queries and as an [MCP server](https://docs.devin.ai/work-with-devin/deepwiki-mcp) to give your AI assistant direct access. Useful for understanding architecture, finding relevant source files, and asking questions about how Quarto works internally.
- **[Context7](https://context7.com)** — Provides up-to-date Quarto documentation and related tool docs. Available as a web UI, a [cli tool](https://context7.com/docs/clients/cli) and as an [MCP server](https://context7.com/docs/resources/all-clients) so AI assistants can fetch current docs on demand.
- **`https://quarto.org/llms.txt`** — Machine-readable index of Quarto documentation, following the [llms.txt convention](https://llmstxt.org/). Point your AI assistant at this URL to give it a structured map of available documentation.
- **Clone the repo** — AI tools that can run code or search files benefit from a local clone. Cloning the repository lets the AI search source files, trace code paths, and verify behavior directly rather than relying on potentially outdated training data.

Grounding your AI assistant in the actual codebase leads to more accurate root cause analysis and better-quality issue reports.

## AI-assisted contributions

AI assistants are welcome to help you investigate, write, and prepare a contribution.
They are accepted only when a human contributor has reviewed, tested, and verified the submission before opening it.

Issues and pull requests opened by autonomous AI agents acting without human oversight are not accepted.
The [Code of Conduct](CODE_OF_CONDUCT.md) names autonomous agents such as OpenClaw as an example, and treats a first offence as account-bannable.

If an AI assistant helped prepare a PR, please complete the AI-assisted section in the [pull request template](pull_request_template.md) so reviewers know how it was grounded and verified.

## Submitting a pull request

1. [Fork](https://github.com/quarto-dev/quarto-cli/fork) the repository, clone it locally, and make your changes in a new branch specific to the PR. For example:

   ```bash
   # clone your fork
   $ git clone https://github.com/<username>/quarto-cli

   # configure for your platform (./configure.sh for linux/mac  or ./configure.cmd for Windows)
   $ cd quarto-cli
   $ ./configure.sh

   # checkout a new branch
   $ git checkout -b bugfix/myfix
   ```

2. Submit the [pull request](https://help.github.com/articles/using-pull-requests). It is ok to submit as a draft if you are still working on it but would like some feedback from us. It is always good to share in the open that you are working on it.

Before you open a PR, please check that you have (when applicable):

- Referenced the GitHub issue this PR closes.
- Updated the relevant changelog in `news/changelog-{version}.md`.
- Ensured the present test suite passes.
- Added new tests for your change.
- Opened a linked documentation PR in [Quarto's website repo](https://github.com/quarto-dev/quarto-web/) when behaviour or documentation changes.

We'll try to be as responsive as possible in reviewing and accepting pull requests. Very much appreciate your contributions!
