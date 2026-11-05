const D = Deno;
const original = Deno.readTextFileSync;
D.readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
