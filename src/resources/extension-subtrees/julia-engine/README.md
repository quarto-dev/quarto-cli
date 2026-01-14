# engine extension for julia in quarto

Quarto will introduce engine extensions in 1.9, and this is an experimental port of Quarto's Julia engine to the new architecture.

Install it with

```
quarto add gordonwoodhull/quarto-julia-engine
```

You'll need the `feature/engine-extension-3` branch of Quarto, until it's merged.

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
