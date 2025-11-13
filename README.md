# engine extension for julia in quarto

Quarto will introduce engine extensions in 1.9, and this is an experimental port of Quarto's Julia engine to the new architecture.

Install it with

```
quarto add gordonwoodhull/quarto-julia-engine
```

You'll need the `feature/engine-extension` branch of Quarto, until it's merged.

## implementation notes

A few system utilities are replaced with small Deno wrappers at the top of `_extensions/julia-engine/julia-engine.ts`. Deno has a better `delay` but it's not in Quarto's export map currently; it also uses `setTimeout()`.

There is a new Quarto API for the more significant utilities, such as Jupyter and Markdown functions. Quarto passes the API down in `ExecutionEngineDiscovery.init()` - this may get called multiple times but it will always pass the same Quarto API object.

The delay in `readTransportFile()` was not awaited previously, so it wasn't effective. Fixing it required making its caller functions async.

Since @quarto/types is a pure types package (vendored into `_extensions/julia-engine/types/quarto-types.d.ts`), it doesn't provide string constants. All Quarto string constants were moved to a `constants.ts` file.
