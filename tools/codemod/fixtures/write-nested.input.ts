if (Deno.env.get("FAKE_OS")) {
  Deno.build.os = "linux";
}
export const isWin = Deno.build.os === "windows";
