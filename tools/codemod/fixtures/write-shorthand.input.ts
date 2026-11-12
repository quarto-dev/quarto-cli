const holder = { Deno };
const original = Deno.readTextFileSync;
holder.Deno.readTextFileSync = (path: string | URL) => original(path);
export const text = Deno.readTextFileSync("x.txt");
