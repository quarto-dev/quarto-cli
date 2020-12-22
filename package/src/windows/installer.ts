import { join } from "path/mod.ts";
import { ensureDir, ensureDirSync } from "https://deno.land/std@0.79.0/fs/ensure_dir.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { download, unzip } from "../util/utils.ts";



export async function makeInstallerWindows(configuration: Configuration) {

    // Working dir
    const workingDir = join(configuration.dirs.out, "working_win");
    ensureDirSync(workingDir);

    // Tools Directory
    const wixDir = join(workingDir, "tools", "wix");
    ensureDirSync(wixDir);

    // Wix information
    const fullVersion = "3112";
    const shortVersion = "311";
    const fileName = `wix${shortVersion}-binaries.zip`;
    const wixToolsUrl = `https://github.com/wixtoolset/wix3/releases/download/wix${fullVersion}rtm/${fileName}`;
    const destZip = join(workingDir, fileName);

    // Download the wix tools
    configuration.log.info(`Downloading ${wixToolsUrl}`);
    configuration.log.info(`to ${destZip}`);
    await download(wixToolsUrl, destZip);

    // Uncompress the wix tools in the supporting directory
    configuration.log.info("Unzipping wix tools...")
    await unzip(destZip, wixDir, configuration.log);

    // Delete the downloaded zip file
    Deno.remove(destZip);

    // heat the directory to generate a wix file for it
    const heat = join(wixDir, "heat");
    runCmd(heat, [], configuration.log);

    // use candle to build the wixobj file
    const candle = join(wixDir, "candle");
    runCmd(candle, [], configuration.log);

    // use light to generate the msi
    const light = join(wixDir, "light");
    runCmd(light, [], configuration.log);

}