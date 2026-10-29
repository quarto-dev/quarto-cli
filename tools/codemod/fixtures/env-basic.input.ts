export function home(): string {
  Deno.env.set("QUARTO_X", "1");
  const all = Deno.env.toObject();
  return Deno.env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
