import { canonicalPathSync, statSync } from "../deno_ral/fs.ts";
export const info = (p: string) => statSync(canonicalPathSync(p));
