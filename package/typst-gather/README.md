# typst-gather

Gather Typst packages locally for offline/hermetic builds.

## Install

```bash
cargo install --path .
```

## Usage

```bash
typst-gather packages.toml
```

Then set `TYPST_PACKAGE_CACHE_PATH` to the destination directory when running Typst.

## TOML format

```toml
destination = "/path/to/packages"

# Single path
discover = "/path/to/templates"

# Or array of paths (files or directories)
discover = ["template.typ", "typst-show.typ", "/path/to/dir"]

[preview]
cetz = "0.4.1"
fontawesome = "0.5.0"

[local]
my-template = "/path/to/src"
```

- `destination` - Required. Directory where packages will be gathered.
- `discover` - Optional. Paths to scan for imports. Can be:
  - A single string path
  - An array of paths
  - Each path can be a `.typ` file or a directory (scans `.typ` files non-recursively)
- `[preview]` packages are downloaded from Typst Universe (cached - skipped if already present)
- `[local]` packages are copied from the specified directory (always fresh - version read from `typst.toml`)

## Features

- Recursively resolves `@preview` dependencies from `#import` statements
- Uses Typst's own parser for reliable import detection
- Discover mode scans .typ files for imports
- Local packages always overwrite (clean slate)
- Preview packages skip if already cached

## Quarto Integration

When used with Quarto extensions, you can run:

```bash
quarto call typst-gather
```

This will auto-detect `.typ` files from `_extension.yml` (template and template-partials) and gather their dependencies.
