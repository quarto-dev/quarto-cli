const original = Deno.readTextFileSync;
(Object.defineProperty)(Deno, "readTextFileSync", { value: (p: string) => original(p) });
export const text = Deno.readTextFileSync("x.txt");
