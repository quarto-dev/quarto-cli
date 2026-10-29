const original = Deno.readTextFileSync;
self["Deno"].readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
