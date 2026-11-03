export const isWin = Deno.build.os === "windows";
(<any> Deno.build).os = "linux";
