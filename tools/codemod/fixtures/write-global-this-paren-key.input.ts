const original = Deno.readTextFileSync;
globalThis[("Deno")].readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
