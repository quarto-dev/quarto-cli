/*
* tex.ts
*
* Copyright (C) 2020-2023 Posit, PBC
*
*/

// there are many characters that give tex trouble in filenames, create
// a target stem that replaces them with the '-' character
export function texSafeFilename(file: string) {
  return file.replaceAll(/[ <>()|\:&;#?*'\\\/]/g, "-");
}
