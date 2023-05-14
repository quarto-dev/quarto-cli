// ensure this is treated as a module
export {};

// establish target js build time
const kQuartoPreviewJs = "../../resources/preview/quarto-preview.js";
let jsBuildTime: number;
try {
  jsBuildTime = Deno.statSync(kQuartoPreviewJs).mtime?.valueOf() || 0;
} catch {
  jsBuildTime = 0;
}

// check if any of our repo files have a later time
let build = false;
try {
  const command = new Deno.Command("git", { args: ["ls-files"] });
  const cmdOutput = await command.output();
  if (cmdOutput.success) {
    const output = new TextDecoder().decode(cmdOutput.stdout);
    const files = output.split("\n").filter((line) => line.length > 0);
    build = files.some((file) =>
      Deno.statSync(file).mtime!.valueOf() > jsBuildTime
    );
  } else { 
    // not in a git repo, rebuild
    build = true;
  }
} catch {
  // git not installed, rebuild
  build = true;
}

if (build) {
  const buildCommand = new Deno.Command(Deno.execPath(), {
    args: ["task", "build"],
  });
  await buildCommand.spawn().status;
}
