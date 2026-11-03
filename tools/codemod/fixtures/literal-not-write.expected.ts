import { lstatSync, readFileSync, readTextFileSync, statSync } from "../deno_ral/fs.ts";
export const fns = { read: readTextFileSync, list: [readFileSync] };
export const all = [...[statSync], { ...{ s: lstatSync } }];
