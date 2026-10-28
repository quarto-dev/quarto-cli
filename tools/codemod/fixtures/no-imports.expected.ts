/*
 * no imports at all
 */

import { readTextFileSync } from "../deno_ral/fs.ts";
export const text = readTextFileSync("x.txt");
