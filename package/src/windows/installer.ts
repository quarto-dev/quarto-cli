import { basename, join } from "path/mod.ts";
import {
  _createWalkEntry,
  emptyDirSync,
  ensureDirSync,
  existsSync,
  moveSync,
} from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { download, getEnv, unzip } from "../util/utils.ts";
import { signtool } from "./signtool.ts";

export async function makeInstallerWindows(configuration: Configuration) {
  const packageName = `quarto-${configuration.version}-win.msi`;

  // Wix information
  const wixFullVersion = "3112";
  const wixShortVersion = "311";

  // Working dir
  const workingDir = join(configuration.directoryInfo.out, "working_win");
  const wixDir = join(workingDir, "tools", `wix-${wixShortVersion}`);

  // Wix commands
  const heatCmd = join(wixDir, "heat");
  const candleCmd = join(wixDir, "candle");
  const lightCmd = join(wixDir, "light");

  // Extract the PFX file that will be used for signing
  const encodedPfx = getEnv("QUARTO_WIN_PFX", "");
  const pfxPw = getEnv("QUARTO_WIN_PFX_PW", "");
  const sign = encodedPfx.length > 0 && pfxPw.length > 0;
  if (!sign) {
    configuration.log.warning(
      "No Signing information available in environment, skipping signing",
    );
  }

  // Download tools, if necessary
  if (
    !existsSync(workingDir) || !existsSync(wixDir) ||
    !existsSync(heatCmd + ".exe")
  ) {
    emptyDirSync(workingDir);
    ensureDirSync(wixDir);

    const fileName = `wix${wixShortVersion}-binaries.zip`;
    const wixToolsUrl =
      `https://github.com/wixtoolset/wix3/releases/download/wix${wixFullVersion}rtm/${fileName}`;

    const destZip = join(workingDir, fileName);

    // Download the wix tools
    configuration.log.info(`Downloading ${wixToolsUrl}`);
    configuration.log.info(`to ${destZip}`);
    await download(wixToolsUrl, destZip);

    // Uncompress the wix tools in the supporting directory
    configuration.log.info("Unzipping wix tools...");
    await unzip(destZip, wixDir, configuration.log);

    // Delete the downloaded zip file
    Deno.remove(destZip);
  }

  if (sign) {
    configuration.log.info("Signing application files");

    const filesToSign = [
      { file: join(configuration.directoryInfo.bin, "quarto.js") },
    ];
    await signtool(
      filesToSign,
      encodedPfx,
      pfxPw,
      workingDir,
      configuration.log,
    );
  }

  // heat the directory to generate a wix file for it
  configuration.log.info("Heating directory");
  const heatOutput = join(workingDir, "quarto-frag.wxs");
  await runCmd(
    heatCmd,
    [
      "dir",
      configuration.directoryInfo.dist,
      "-var",
      "var.SourceDir",
      "-gg",
      "-sfrag",
      "-srd",
      "-cg",
      "ProductComponents",
      "-dr",
      "APPLICATIONFOLDER",
      "-out",
      heatOutput,
    ],
    configuration.log,
  );

  // use candle to build the wixobj file
  configuration.log.info("Making the candle");
  const candleFiles = [
    join(configuration.directoryInfo.pkg, "src", "windows", "quarto.wxs"),
    heatOutput,
  ];
  const candleOutput: string[] = [];
  await Promise.all(candleFiles.map(async (candleInput) => {
    const outputFileName = basename(candleInput, ".wxs");
    const outputPath = join(workingDir, outputFileName + ".wixobj");
    candleOutput.push(outputPath);
    return await runCmd(
      candleCmd,
      [
        `-dSourceDir=${configuration.directoryInfo.dist}`,
        "-out",
        outputPath,
        candleInput,
      ],
      configuration.log,
    );
  }));

  configuration.log.info("Lighting the candle");
  const licenseRtf = join(
    configuration.directoryInfo.pkg,
    "src",
    "windows",
    "license.rtf",
  );

  // Set the installer version
  Deno.env.set("QUARTO_INSTALLER_VERSION", configuration.version);

  const lightOutput = join(workingDir, packageName);
  const lightArgs = ["-out", lightOutput, ...candleOutput];
  lightArgs.push("-ext");
  lightArgs.push("WixUtilExtension");
  lightArgs.push("-ext");
  lightArgs.push("WixUIExtension");
  lightArgs.push(`-dWixUILicenseRtf=${licenseRtf}`);
  await runCmd(lightCmd, lightArgs, configuration.log);

  // Use signtool to sign the MSI
  if (sign) {
    configuration.log.info("Signing installer");
    await signtool(
      [{ file: lightOutput, desc: "Quarto CLI" }],
      encodedPfx,
      pfxPw,
      workingDir,
      configuration.log,
    );
  }

  configuration.log.info(
    `Moving ${lightOutput} to ${configuration.directoryInfo.out}`,
  );
  moveSync(
    lightOutput,
    join(configuration.directoryInfo.out, basename(lightOutput)),
    { overwrite: true },
  );

  // Clean up the working directory
  Deno.remove(workingDir, { recursive: true });
}
