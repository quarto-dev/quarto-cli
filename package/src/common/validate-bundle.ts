/*
* prepare-dist.ts
*
* Copyright (C) 2020-2024 Posit Software, PBC
*
*/
import { join } from "../../../src/deno_ral/path.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { Configuration } from "./config.ts";
import { execProcess } from "../../../src/core/process.ts";
import { PackageCommand } from "../cmd/pkg-cmd.ts";
import { Command } from "npm:clipanion";

export async function validateBundle(
  config: Configuration,
) {
    const bugFinderDir = join(config.directoryInfo.tools, "bundle-bug-finder");
    
    // Move the JS file
    const targetJs = join(config.directoryInfo.pkgWorking.bin, "quarto.js");

    const moveScriptDest = join(bugFinderDir, "quarto.js");
    Deno.copyFileSync(targetJs, moveScriptDest);

    const outFile = join(bugFinderDir, "bundle.js");

    // Set the working dir to bug finder
    Deno.chdir(bugFinderDir);

    try {

    // NPM Install
    info("Installing Dependencies");
    const npm = await execProcess({
      cmd: ["npm", "install"],
      stderr: "piped"
    }); 
    if (!npm.success) {
      throw new Error(npm.stderr);
    }
    info("");

    // Create a new bundled output
    info("Creating Test Bundle");
    
    const files = [join(bugFinderDir, "_prelude.js"), targetJs];
    files.forEach((file) => {
      const text = Deno.readTextFileSync(file);
      Deno.writeTextFileSync(outFile, text, {create: true, append: true});
    })
    info("");

    // Test the bundled output
    info("Testing Bundled output");
    const npx = await execProcess({
      cmd: ["npx", "eslint", "bundle.js"],
      stderr: "piped"

    });
    if (!npx.success) {
      throw new Error(npx.stderr);
    }
    info("TEST: OK");
  } finally {
    const cleanupFiles = [moveScriptDest, outFile, "package-lock.json", "node_modules"];
    cleanupFiles.forEach((file) => {
      Deno.removeSync(file, {recursive: true});
    })

  }
}

export class ValidateBundleCommand extends PackageCommand {
    static paths = [["validate-bundle"]];

    static usage = Command.Usage({
        description: "Validate a JS bundle built using prepare-dist",
    });

    async execute() {
        await super.execute();
        await validateBundle(this.config)
    }
}
