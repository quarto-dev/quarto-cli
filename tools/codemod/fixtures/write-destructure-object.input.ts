const instrumented = { readTextFileSync: Deno.readTextFileSync };
({ readTextFileSync: Deno.readTextFileSync } = instrumented);
export const text = Deno.readTextFileSync("x.txt");
