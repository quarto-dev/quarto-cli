export function detectChromePlatform(platform: string) {
  return { platform, os: Deno.build.os, arch: Deno.build.arch };
}
