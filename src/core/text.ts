/*
* text.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function lines(text: string): string[] {
  return text.split(/\r?\n/);
}

export function normalizeNewlines(text: string) {
  return lines(text).join("\n");
}
