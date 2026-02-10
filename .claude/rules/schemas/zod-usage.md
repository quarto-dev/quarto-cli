---
paths:
  - "src/resources/schema/**/*"
  - "src/resources/types/**/*"
  - "src/core/brand/**/*"
  - "src/project/**/*"
---

# Zod Schema Usage Patterns

Guidance on when to use Zod validation vs type assertions in the Quarto codebase.

## Overview

Zod schemas are generated from YAML schema definitions but have **specific use cases**. Understanding when to use each approach is critical.

## When Zod IS Used (Entry Points for External Data)

Use `Zod.*.parse()` for runtime validation when:

- Loading brand data from `_brand.yml` files ([brand.ts:65](src/core/brand/brand.ts))
- Processing extension metadata ([project-context.ts:128](src/project/project-context.ts))
- Parsing metadata from files at boundaries ([project-shared.ts:606](src/project/project-shared.ts))
- Validating complex navigation structures ([book-config.ts:262](src/project/types/book/book-config.ts))

```typescript
// Example: Validating external data at entry points
const brand = Zod.BrandSingle.parse(externalBrandData);
const navItem = Zod.NavigationItemObject.parse(item);
```

## When Type Assertions ARE Used (Internal Processing)

Most code works with `project.config` which has **already been validated** when loaded via `readAndValidateYamlFromFile()` ([project-context.ts:463](src/project/project-context.ts)). In these cases, use type assertions with `Metadata`:

```typescript
// Standard pattern for already-validated config data
const siteMeta = project.config?.[kWebsite] as Metadata;
if (siteMeta) {
  const configValue = siteMeta[kConfigKey];
  if (typeof configValue === "object") {
    const configMeta = configValue as Metadata;
    const property = configMeta[kPropertyName] as string;
    // ... use property
  }
}
```

## Key Principle

YAML schema validation happens at config load time, so downstream code doesn't need redundant Zod validation. Reserve Zod for true entry points where external/untrusted data enters the system.

## File Locations

- YAML schema definitions: `src/resources/schema/definitions.yml`
- Generated Zod schemas: `src/resources/types/zod/schema-types.ts`
- Generated TypeScript types: `src/resources/types/schema-types.ts`
- JSON schemas: `src/resources/schema/json-schemas.json`

## Regenerating Schemas

After modifying YAML schema definitions:

```bash
package/dist/bin/quarto dev-call build-artifacts    # Linux/macOS
package/dist/bin/quarto.cmd dev-call build-artifacts  # Windows
```
