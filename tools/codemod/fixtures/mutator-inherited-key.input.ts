const constructor = { inspect: (f: unknown) => String(f) };
export const shown = constructor.inspect(Deno.readTextFileSync);
export const text = Deno.readTextFileSync("x.txt");
