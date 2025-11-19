# <%= title %> Extension For Quarto

_TODO_: Add a short description of your extension.

## Installing

_TODO_: Replace the `<github-organization>` with your GitHub organization.

```bash
quarto add <github-organization>/<%= filesafename %>
```

This will install the extension under the `_extensions` subdirectory.
If you're using version control, you will want to check in this directory.

## Developing

This extension is written in TypeScript. The source code is in the `src/` directory.

### Building

To build the extension, you need to set up the build configuration and then run the build command:

```bash
# Build the TypeScript source to JavaScript
quarto dev-call build-ts-extension
```

This will:

- Type-check your TypeScript code against Quarto's API types
- Bundle the extension into `_extensions/<%= filesafename %>/<%= filesafename %>.js`

The built JavaScript file should be committed to version control along with the source.

Optionally, you can create a deno.json to further customize the build:

```bash
# First time setup - creates deno.json with import map configuration
quarto dev-call build-ts-extension --init-config
```

## Using

_TODO_: Describe how to use your extension.

## Example

Here is the source code for a minimal example: [example.qmd](example.qmd).
