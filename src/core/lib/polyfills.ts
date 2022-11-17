/*
* polyfills.ts
*
* some polyfills we can't depend on in older execution environments.
*
* Copyright (C) 2022 Posit Software, PBC
*
* (Note that code here is derived from other open-source libraries. We include a link and respective copyright notice)
*
*/

// based on https://raw.githubusercontent.com/feross/fromentries/master/index.js
// MIT License. Feross Aboukhadijeh <https://feross.org/opensource>
export function fromEntries<T>(
  iterable: [string, T][],
): Record<string, T> {
  return [...iterable].reduce((obj, [key, val]) => {
    obj[key] = val;
    return obj;
  }, {} as Record<string, T>);
}
