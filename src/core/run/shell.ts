/*
* shell.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export function parseShellRunCommand(cmdLine: string) {
  let space = "{{space}}";
  while (cmdLine.indexOf(space) > -1) {
    space += "&";
  }
  const noSpaces = cmdLine.replace(
    /"([^"]*)"?/g,
    (_, capture) => {
      return capture.replace(/ /g, space);
    },
  );
  const paramArray = noSpaces.split(/ +/);
  return paramArray.map((mangled) => {
    return mangled.replace(RegExp(space, "g"), " ");
  });
}
