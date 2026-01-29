# Orange Book Format Extension for Quarto

A Quarto format extension that provides Typst book support using the [orange-book](https://typst.app/universe/package/orange-book) package.

## Installation

Orange-book will be bundled with Quarto 1.9 and will be the default extension for Typst book projects.

However, if you want to explicitly install and use this extension

```bash
quarto add quarto-ext/orange-book
```

## Usage

In your `_quarto.yml`:

```yaml
project:
  type: book

format: orange-book-typst
```

## Features

- Transforms book parts into `#part[...]` calls for proper orange-book formatting
- Handles appendix sections with `#show: appendices.with(...)`
- Chapter-based numbering for equations, callouts, and cross-references
- Integrates with Quarto's brand system for colors and logos

## Requirements

- Quarto >= 1.9.17
- The `orange-book` Typst package (automatically imported and bundled with [typst-gather](https://prerelease.quarto.org/docs/advanced/typst/typst-gather.html))

## How It Works

This extension:

1. Provides template partials (`typst-show.typ`, `numbering.typ`) that configure the orange-book package
2. Includes a Lua filter (`orange-book.lua`) that transforms Quarto's book structure into orange-book-specific Typst commands
3. Uses Quarto's `file_metadata` API to detect book item types (parts, chapters, appendices)

## License

MIT
