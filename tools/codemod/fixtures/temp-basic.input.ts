export function scratch(options?: Deno.MakeTempOptions): string {
  return Deno.makeTempDirSync({ prefix: "q-", ...options });
}
