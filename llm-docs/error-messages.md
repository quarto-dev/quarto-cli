# Writing Error Messages in Quarto

## The Rule

Each `error()`, `warning()`, or `info()` call should be **exactly one line**.

- ✅ End messages with `\n` to add blank lines after
- ❌ Never start messages with `\n`
- ❌ Never use empty `error("")` calls

## Why This Matters

Quarto's logging prefixes each call with `ERROR:` / `WARNING:` / `INFO:`. Starting a message with `\n` or using empty calls creates confusing output:

```
ERROR: Multiple files found
ERROR:
Or specify entry point:    ← Empty "ERROR:" line from \n at start
```

## Adding Blank Lines

To add a blank line between sections, end the **previous** message with `\n`:

### ✅ Good

```typescript
error("Multiple .ts files found in src/\n");  // \n at END
error("Specify entry point as argument:");
error("  quarto call build-ts-extension src/my-engine.ts");
```

Output:
```
ERROR: Multiple .ts files found in src/
ERROR:
ERROR: Specify entry point as argument:
ERROR:   quarto call build-ts-extension src/my-engine.ts
```

### ❌ Bad

```typescript
error("Multiple .ts files found in src/");
error("\nSpecify entry point as argument:");  // \n at START
error("  quarto call build-ts-extension src/my-engine.ts");
```

Output:
```
ERROR: Multiple .ts files found in src/
ERROR:
ERROR: Specify entry point as argument:     ← Blank "ERROR:" line before
ERROR:   quarto call build-ts-extension src/my-engine.ts
```

### ❌ Also Bad

```typescript
error("Multiple .ts files found in src/");
error("");  // Empty call to add spacing
error("Specify entry point as argument:");
```

Output:
```
ERROR: Multiple .ts files found in src/
ERROR:                                      ← Empty "ERROR:" line
ERROR: Specify entry point as argument:
```

## Complete Example

Here's a real example from `build-ts-extension` showing proper formatting:

### ✅ Good

```typescript
error("No src/ directory found.\n");
error("Create a TypeScript file in src/:");
error("  mkdir -p src");
error("  touch src/my-engine.ts\n");
error("Or specify entry point as argument:");
error("  quarto call build-ts-extension src/my-engine.ts");
```

Output:
```
ERROR: No src/ directory found.
ERROR:
ERROR: Create a TypeScript file in src/:
ERROR:   mkdir -p src
ERROR:   touch src/my-engine.ts
ERROR:
ERROR: Or specify entry point as argument:
ERROR:   quarto call build-ts-extension src/my-engine.ts
```

Notice:
- Each `error()` call is one complete line
- Blank lines are created by ending the previous message with `\n`
- Indentation (with spaces) is preserved within each message
- Message flow is clear and readable
