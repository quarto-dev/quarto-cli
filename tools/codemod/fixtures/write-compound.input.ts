const instrument = <T>(f: T): T => f;
Deno.readTextFileSync &&= instrument(Deno.readTextFileSync);
export const text = Deno.readTextFileSync("x.txt");
