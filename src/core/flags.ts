/*
* flags.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export function removeFlags(flags: string[], remove: Map<string, boolean>) {
  let removeNext = false;
  return flags.reduce((args, arg) => {
    if (!remove.has(arg)) {
      if (!removeNext) {
        args.push(arg);
      }
      removeNext = false;
    } else {
      removeNext = remove.get(arg)!;
    }
    return args;
  }, new Array<string>());
}
