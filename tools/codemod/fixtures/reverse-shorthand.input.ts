import { arch, os } from "../deno_ral/platform.ts";
export function detectChromePlatform(platform: string) {
  return { platform, os, arch };
}
