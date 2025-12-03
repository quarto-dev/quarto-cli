# Build TypeScript Extension Test

This is a minimal test extension for the `quarto dev-call build-ts-extension` command.

## Structure

- `src/test-engine.ts` - TypeScript source implementing ExecutionEngineDiscovery
- `deno.json` - Configuration with quartoExtension options and inline imports
- `_extensions/test-engine/` - Output directory for built extension
- `_extensions/test-engine/_extension.yml` - Extension metadata

## Testing

Prerequisites:
```bash
# Build quarto-types first
cd packages/quarto-types
npm run build
cd ../..
```

To build the test extension:
```bash
cd tests/smoke/build-ts-extension
quarto dev-call build-ts-extension
```

To type-check only:
```bash
quarto dev-call build-ts-extension --check
```

## Expected Output

After building, you should see:
- `_extensions/test-engine/test-engine.js` - Bundled JavaScript file
- Type checking passes with no errors
- Success message indicating build completion

## Notes

- This test uses inline `imports` in deno.json pointing directly to `packages/quarto-types/dist/index.d.ts`
- In a real extension project, you would typically use the default config from Quarto's `share/extension-build/` directory
- The default config is available at `src/resources/extension-build/` in dev mode
