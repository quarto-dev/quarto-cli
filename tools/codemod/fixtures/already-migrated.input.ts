import { stat as fsStat, statSync } from "../deno_ral/fs.ts";

export async function sizes(a: string, b: string): Promise<number> {
  const stat = await Deno.stat(a);
  return stat.size + statSync(a).size + Deno.statSync(b).size + (await fsStat(b)).size;
}
