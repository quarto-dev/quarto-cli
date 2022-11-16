/*
* paths.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

let mainPath = "";

export function setMainPath(path: string) {
  mainPath = path;
}

// NB this doesn't do path resolution past the current directory!
export function getLocalPath(filename: string): string {
  const result = new URL(mainPath);
  result.pathname = [...result.pathname.split("/").slice(0, -1), filename].join(
    "/",
  );
  return result.toString();
}
