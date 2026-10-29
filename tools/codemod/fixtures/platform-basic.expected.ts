import { arch, os } from "../deno_ral/platform.ts";
export const sep = os === "windows" ? "\\" : "/";
export const bits = arch;
