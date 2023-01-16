/*
* utils.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { fileLoader } from "../../utils.ts";
// import { docs, outputForInput } from "../../utils.ts";

// export function crossref(file: string, to: string) {
//   const input = docs(join("crossrefs", file));
//   const output = outputForInput(input, to);
//   return {
//     input,
//     output,
//   };
// }

export const crossref = fileLoader("crossrefs");
