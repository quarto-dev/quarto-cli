import { stat as fsStat, statSync } from "../deno_ral/fs.ts";

export async function sizes(a: string, b: string): Promise<number> {
  const stat = await fsStat(a);
  return stat.size + statSync(a).size + statSync(b).size + (await fsStat(b)).size;
}
