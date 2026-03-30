# Julia engine extension for quarto

Quarto's Julia engine, extracted from quarto-cli into a standalone engine extension. It was originally built directly into quarto-cli and is now pulled back in via a git subtree.

## Development

To build the TypeScript engine extension:

```bash
quarto call build-ts-extension src/julia-engine.ts
```

This bundles `src/julia-engine.ts` into `_extensions/julia-engine/julia-engine.js`.

## Implementation notes

A few system utilities are replaced with small Deno wrappers at the top of `src/julia-engine.ts`. Deno has a better `delay` but it's not in Quarto's export map currently; it also uses `setTimeout()`.

There is a new Quarto API for the more significant utilities, such as Jupyter and Markdown functions. Quarto passes the API down in `ExecutionEngineDiscovery.init()` - this may get called multiple times but it will always pass the same Quarto API object.

The delay in `readTransportFile()` was not awaited previously, so it wasn't effective. Fixing it required making its caller functions async.

String constants are defined in `src/constants.ts`.
