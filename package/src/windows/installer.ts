import { basename, join } from "path/mod.ts";
import { emptyDirSync, ensureDirSync, existsSync, moveSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { download, unzip } from "../util/utils.ts";


export async function makeInstallerWindows(configuration: Configuration) {

    // Wix information
    const wixFullVersion = "3112";
    const wixShortVersion = "311";

    // Working dir
    const workingDir = join(configuration.dirs.out, "working_win");
    const wixDir = join(workingDir, "tools", `wix-${wixShortVersion}`);

    const heatCmd = join(wixDir, "heat");
    const candleCmd = join(wixDir, "candle");
    const lightCmd = join(wixDir, "light");

    // Download tools, if necessary
    if (!existsSync(workingDir) || !existsSync(wixDir) || !existsSync(heatCmd + ".exe")) {
        emptyDirSync(workingDir);
        ensureDirSync(wixDir);

        const fileName = `wix${wixShortVersion}-binaries.zip`;
        const wixToolsUrl = `https://github.com/wixtoolset/wix3/releases/download/wix${wixFullVersion}rtm/${fileName}`;

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

    }

    // heat the directory to generate a wix file for it 
    const heatOutput = join(workingDir, "quarto-frag.wxs");
    await runCmd(heatCmd, ["dir", configuration.dirs.dist, "-var", "var.SourceDir", "-gg", "-sfrag", "-srd", "-cg", "ProductComponents", "-dr", "INSTALLFOLDER", "-out", heatOutput], configuration.log);

    // TODO: Process the version and other metadata into the WXS file
    // use candle to build the wixobj file
    const candleFiles = [join(configuration.dirs.pkg, "src", "windows", "quarto.wxs"), heatOutput]
    const candleOutput: string[] = []
    await Promise.all(candleFiles.map(async candleInput => {
        const outputFileName = basename(candleInput, ".wxs");
        const outputPath = join(workingDir, outputFileName + ".wixobj");
        candleOutput.push(outputPath);
        return runCmd(candleCmd, [`-dSourceDir=${configuration.dirs.dist}`, "-out", outputPath, candleInput], configuration.log);
    }));


    const lightOutput = join(workingDir, `quarto-${configuration.version}.msi`);
    await runCmd(lightCmd, ["-out", lightOutput, ...candleOutput], configuration.log);

    configuration.log.info(`Moving ${lightOutput} to ${configuration.dirs.out}`);
    moveSync(lightOutput, join(configuration.dirs.out, basename(lightOutput)), { overwrite: true });

    // Clean up the working directory
    Deno.remove(workingDir);
}