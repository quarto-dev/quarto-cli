export const fns = { read: Deno.readTextFileSync, list: [Deno.readFileSync] };
export const all = [...[Deno.statSync], { ...{ s: Deno.lstatSync } }];
