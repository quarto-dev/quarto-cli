export function reset() {
  delete Deno.env;
}
export const home = Deno.env.get("HOME");
