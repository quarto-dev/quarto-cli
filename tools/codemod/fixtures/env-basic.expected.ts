import { env } from "../deno_ral/env.ts";
export function home(): string {
  env.set("QUARTO_X", "1");
  const all = env.toObject();
  return env.get("HOME") ?? all["USERPROFILE"] ?? "";
}
