// establish target js build time
const kQuartoPreviewJs = "../../resources/preview/quarto-preview.js";
let jsBuildTime: number;
try {
  jsBuildTime = Deno.statSync(kQuartoPreviewJs).mtime?.valueOf() || 0;
} catch {
  jsBuildTime = 0;
}

// check if any of our repo files have a later time
const command = new Deno.Command("git", { args: ["ls-files"] });
const output = new TextDecoder().decode((await command.output()).stdout);
const files = output.split("\n").filter((line) => line.length > 0);
if (files.some((file) => Deno.statSync(file).mtime!.valueOf() > jsBuildTime)) {
  const buildCommand = new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
  });
  await buildCommand.spawn().status;
}
