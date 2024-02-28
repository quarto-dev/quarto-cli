import { info, warning } from "../../../src/deno_ral/log.ts";
import { basename, dirname, join } from "../../../src/deno_ral/path.ts";
import { emptyDirSync, ensureDirSync, existsSync, moveSync } from "fs/mod.ts";

import { Configuration } from "../common/config.ts";
import { runCmd } from "../util/cmd.ts";
import { download, getEnv, unzip } from "../util/utils.ts";
import { signtool } from "./signtool.ts";
import { execProcess } from "../../../src/core/process.ts";
import { copySync } from "fs/copy.ts";

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
    warning(
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
    info(`Downloading ${wixToolsUrl}`);
    info(`to ${destZip}`);
    await download(wixToolsUrl, destZip);

    // Uncompress the wix tools in the supporting directory
    info("Unzipping wix tools...");
    await unzip(destZip, wixDir);

    // Delete the downloaded zip file
    Deno.remove(destZip);
  }

  // Copy the 'dist' files into a temporary working directory
  const tempDir = Deno.makeTempDirSync();
  const workingDistPath = join(tempDir, "dist");
  const workingBinPath = join(workingDistPath, "bin");
  const workingToolsPath = join(workingBinPath, "tools", );
  const archToolsPath = join(workingToolsPath, "x86_64");
  copySync(configuration.directoryInfo.pkgWorking.root, workingDistPath);

  if (sign) {
    info("Signing application files");

    const filesToSign = [
      { file: join(workingBinPath, "quarto.exe") },
      { file: join(archToolsPath, "deno.exe") },
      { file: join(archToolsPath, "esbuild.exe") },
      { file: join(workingToolsPath, "pandoc.exe") },
      {
        file: join(
          archToolsPath,
          "dart-sass",
          "src",
          "dart.exe",
        ),
      },
      { file: join(archToolsPath, "deno_dom", "plugin.dll") },
      { file: join(workingBinPath, "quarto.js") },
    ];
    await signtool(
      filesToSign,
      encodedPfx,
      pfxPw,
      workingDir,
    );
  }

  // Create a zip file
  info("Creating zip installer");
  const zipInput = join(workingDistPath, "*");
  const zipOutput = join(
    configuration.directoryInfo.out,
    `quarto-${configuration.version}-win.zip`,
  );
  await zip(zipInput, zipOutput);

  // Set the installer version
  Deno.env.set("QUARTO_INSTALLER_VERSION", configuration.version);

  // heat the directory to generate a wix file for it
  info("Heating directory");
  const heatOutput = join(workingDir, "quarto-frag.wxs");
  await runCmd(
    heatCmd,
    [
      "dir",
      workingDistPath,
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
  );

  // use candle to build the wixobj file
  info("Making the candle");
  const candleFiles = [
    join(
      configuration.directoryInfo.pkg,
      "src",
      "windows",
      "WixUI_Advanced_Custom.wxs",
    ),
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
        `-dSourceDir=${workingDistPath}`,
        "-arch",
        "x64",
        "-out",
        outputPath,
        candleInput,
      ],
    );
  }));

  info("Lighting the candle");
  const licenseRtf = join(
    configuration.directoryInfo.pkg,
    "src",
    "windows",
    "license.rtf",
  );

  const lightOutput = join(workingDir, packageName);
  const lightArgs = ["-out", lightOutput, ...candleOutput];
  lightArgs.push("-ext");
  lightArgs.push("WixUtilExtension");
  lightArgs.push("-ext");
  lightArgs.push("WixUIExtension");
  lightArgs.push(`-dWixUILicenseRtf=${licenseRtf}`);
  await runCmd(lightCmd, lightArgs);

  Deno.env.delete("QUARTO_INSTALLER_VERSION");

  // Use signtool to sign the MSI
  if (sign) {
    info("Signing installer");
    await signtool(
      [{ file: lightOutput, desc: "Quarto CLI" }],
      encodedPfx,
      pfxPw,
      workingDir,
    );
  }

  info(
    `Moving ${lightOutput} to ${configuration.directoryInfo.out}`,
  );
  moveSync(
    lightOutput,
    join(configuration.directoryInfo.out, basename(lightOutput)),
    { overwrite: true },
  );

  // Clean up the working directory
  Deno.remove(workingDir, { recursive: true });
  Deno.remove(workingDistPath, { recursive: true });
}

export function zip(input: string, output: string) {
  const dir = dirname(input);
  const cmd = [
    "Compress-Archive",
    "-Force",
    input,
    "-DestinationPath",
    output,
  ];
  info(["powershell", ...cmd]);
  return execProcess("powershell",
    {
      args: cmd,
      cwd: dir,
      stdout: "piped",
    },
  );
}
