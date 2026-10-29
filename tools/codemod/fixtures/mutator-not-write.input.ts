export const copy = Object.assign({}, { read: Deno.readTextFileSync });
export const hasDeno = typeof Deno !== "undefined";
export const text = Deno.readTextFileSync("x.txt");
