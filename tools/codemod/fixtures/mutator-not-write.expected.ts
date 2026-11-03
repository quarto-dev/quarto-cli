import { readTextFileSync } from "../deno_ral/fs.ts";
export const copy = Object.assign({}, { read: readTextFileSync });
export const hasDeno = typeof Deno !== "undefined";
export const text = readTextFileSync("x.txt");
