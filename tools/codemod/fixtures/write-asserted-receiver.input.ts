const original = Deno.readTextFileSync;
(Deno as any).readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
