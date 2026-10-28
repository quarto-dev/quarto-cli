const replacement = (_path: string | URL) => "";
(Deno.readTextFileSync as any) = replacement;
export const text = Deno.readTextFileSync("x.txt");
