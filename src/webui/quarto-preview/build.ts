import { dirname } from "node:path";

// ensure this is treated as a module
export {};

const args = Deno.args;

// establish target js build time
const kQuartoPreviewJs = "../../resources/preview/quarto-preview.js";
let jsBuildTime: number;
try {
  jsBuildTime = Deno.statSync(kQuartoPreviewJs).mtime?.valueOf() || 0;
} catch {
  jsBuildTime = 0;
}

const buildFromArgs = () => {
  return args.includes("--force");
};

const run = async (args: string[], quiet = true) => {
  console.log(`Running: npm ${args.join(" ")}`);
  const command = new Deno.Command("npm", {
    args,
  });
  const output = await command.output();
  if (output.success || quiet) {
    return output;
  }
  console.error("Command failed");
  console.log(new TextDecoder().decode(output.stderr));
  Deno.exit(output.code);
};

const buildFromGit = async () => {
  let output: Deno.CommandOutput;
  try {
    const command = new Deno.Command("git", { args: ["ls-files"] });
    output = await command.output();
  } catch {
    // git not installed, rebuild
    return true;
  }
  if (!output.success) {
    return true;
  }
  const stdout = new TextDecoder().decode(output.stdout);
  const files = stdout.split("\n").filter((line) => line.length > 0);
  return files.some((file) =>
    Deno.statSync(file).mtime!.valueOf() > jsBuildTime
  );
};

// check if any of our repo files have a later time
const build = buildFromArgs() || await buildFromGit();

if (!build) {
  console.log("No changes to quarto-preview.js, skipping build");
  Deno.exit(0);
}

console.log("Building quarto-preview.js");
console.log("Installing...");
await run(["install"], false);
console.log("Building...");
await run(["run", "build"], false);
