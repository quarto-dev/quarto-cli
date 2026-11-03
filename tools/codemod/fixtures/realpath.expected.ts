import { canonicalPathSync } from "../deno_ral/fs.ts";
export const canonical = (p: string) => canonicalPathSync(p);
