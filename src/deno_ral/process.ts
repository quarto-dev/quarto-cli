/*
 * process.ts
 *
 * Copyright (C) 2025 Posit Software, PBC
 */

export const call = async (path: string, opts: Deno.CommandOptions = {}) => {
  const cmd = new Deno.Command(path, opts);
  return cmd.output();
};
