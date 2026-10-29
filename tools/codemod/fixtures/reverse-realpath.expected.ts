import { canonicalPathSync } from "../deno_ral/fs.ts";
export const info = (p: string) => Deno.statSync(canonicalPathSync(p));
