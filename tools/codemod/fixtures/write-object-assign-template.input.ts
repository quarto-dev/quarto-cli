export const isWin = Deno.build.os === "windows";
Object[`assign`](Deno.build, { os: "linux" });
