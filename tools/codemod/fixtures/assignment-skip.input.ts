const original = Deno.readTextFileSync;
Deno.readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
