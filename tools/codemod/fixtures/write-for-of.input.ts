export const isWin = Deno.build.os === "windows";
for (Deno.build.os of ["linux"]) break;
