/*
 * env.ts
 *
 * Copyright (C) 2026 Posit Software, PBC
 *
 * Process environment, implemented on Deno.env. The contract is
 * tests/unit/ral/env.test.ts.
 *
 * The methods are plain functions (no `this`): callers pass them as callbacks
 * (quarto-core/dotenv.ts: `names.forEach(env.delete)`).
 */

// Deno.env throws on an empty name or one containing "=" or NUL, while
// Node's process.env silently returns undefined (or stores garbage). The
// layer validates names itself so that every runtime rejects the same ones.
function checkName(name: string): void {
  if (name.length === 0 || name.includes("=") || name.includes("\0")) {
    throw new TypeError(
      `Invalid environment variable name: ${JSON.stringify(name)}`,
    );
  }
}

export const env = {
  get(name: string): string | undefined {
    checkName(name);
    return Deno.env.get(name);
  },
  set(name: string, value: string): void {
    checkName(name);
    if (value.includes("\0")) {
      throw new TypeError(`Invalid value for environment variable ${name}`);
    }
    Deno.env.set(name, value);
  },
  delete(name: string): void {
    checkName(name);
    Deno.env.delete(name);
  },
  toObject(): Record<string, string> {
    return Deno.env.toObject();
  },
};
