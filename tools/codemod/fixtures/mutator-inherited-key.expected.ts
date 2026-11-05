import { readTextFileSync } from "../deno_ral/fs.ts";
const constructor = { inspect: (f: unknown) => String(f) };
export const shown = constructor.inspect(readTextFileSync);
export const text = readTextFileSync("x.txt");
