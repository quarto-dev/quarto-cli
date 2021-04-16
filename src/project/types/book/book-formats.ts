/*
* book-formats.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

const kBookFormats = ["pdf", "epub"];

export function bookOutputFormats(
  projFormats: string[],
  _inputFormats: string[],
) {
  const formats: string[] = [];

  for (const format of projFormats) {
    if (kBookFormats.includes(format)) {
      formats.push(format);
    }
  }

  return formats;
}
