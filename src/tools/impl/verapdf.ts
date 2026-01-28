/*
 * verapdf.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync, safeRemoveSync } from "../../deno_ral/fs.ts";
import { basename, join } from "../../deno_ral/path.ts";

import { unzip } from "../../core/zip.ts";
import { execProcess } from "../../core/process.ts";
import { quartoDataDir } from "../../core/appdirs.ts";

import {
  InstallableTool,
  InstallContext,
  kUpdatePath,
  PackageInfo,
  RemotePackageInfo,
} from "../types.ts";
import { createToolSymlink, removeToolSymlink } from "../tools.ts";
import { isWindows } from "../../deno_ral/platform.ts";

// S3 bucket for veraPDF downloads
const kBucketBaseUrl = "https://s3.amazonaws.com/rstudio-buildtools/quarto";
const kDefaultVersion = "1.28.2";

// Supported Java versions for veraPDF
const kSupportedJavaVersions = [8, 11, 17, 21];

// The name of the file that we use to store the installed version
const kVersionFileName = "version";

export const verapdfInstallable: InstallableTool = {
  name: "VeraPDF",
  prereqs: [{
    check: async () => {
      const javaVersion = await getJavaVersion();
      return javaVersion !== undefined &&
        kSupportedJavaVersions.includes(javaVersion);
    },
    os: ["darwin", "linux", "windows"],
    message:
      `Java is not installed or version is not supported. veraPDF requires Java 8, 11, 17, or 21.`,
  }],
  installed,
  installDir,
  binDir,
  installedVersion,
  latestRelease,
  preparePackage,
  install,
  afterInstall,
  uninstall,
};

async function getJavaVersion(): Promise<number | undefined> {
  try {
    const result = await execProcess({
      cmd: "java",
      args: ["-version"],
      stderr: "piped",
    });
    if (!result.success) {
      return undefined;
    }
    // Java outputs version to stderr
    // Parse: openjdk version "17.0.1" or java version "1.8.0_301"
    const match = result.stderr?.match(/version "(\d+)(?:\.(\d+))?/);
    if (match) {
      const major = parseInt(match[1]);
      // Java 8 reports as "1.8", newer versions report as "11", "17", etc.
      return major === 1 ? parseInt(match[2]) : major;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function verapdfInstallDir(): string {
  return quartoDataDir("verapdf");
}

async function installed(): Promise<boolean> {
  const dir = verapdfInstallDir();
  const verapdfBin = isWindows
    ? join(dir, "verapdf.bat")
    : join(dir, "verapdf");
  return existsSync(verapdfBin);
}

async function installDir(): Promise<string | undefined> {
  if (await installed()) {
    return verapdfInstallDir();
  }
  return undefined;
}

async function binDir(): Promise<string | undefined> {
  if (await installed()) {
    return verapdfInstallDir();
  }
  return undefined;
}

async function installedVersion(): Promise<string | undefined> {
  const dir = verapdfInstallDir();
  const versionFile = join(dir, kVersionFileName);
  if (existsSync(versionFile)) {
    return await Deno.readTextFile(versionFile);
  }
  return undefined;
}

function noteInstalledVersion(version: string): void {
  const dir = verapdfInstallDir();
  const versionFile = join(dir, kVersionFileName);
  Deno.writeTextFileSync(versionFile, version);
}

async function latestRelease(): Promise<RemotePackageInfo> {
  // Use pinned version from configuration or default
  const version = Deno.env.get("VERAPDF") || kDefaultVersion;
  const filename = `verapdf-greenfield-${version}-installer.zip`;
  const downloadUrl = `${kBucketBaseUrl}/verapdf/${version}/${filename}`;

  return {
    url: downloadUrl,
    version,
    assets: [{ name: filename, url: downloadUrl }],
  };
}

async function preparePackage(context: InstallContext): Promise<PackageInfo> {
  const pkgInfo = await latestRelease();
  const version = pkgInfo.version;
  const asset = pkgInfo.assets[0];
  const filePath = join(context.workingDir, asset.name);

  await context.download(`VeraPDF ${version}`, asset.url, filePath);
  return { filePath, version };
}

async function install(
  pkgInfo: PackageInfo,
  context: InstallContext,
): Promise<void> {
  const targetDir = verapdfInstallDir();

  // Extract the downloaded ZIP
  await context.withSpinner(
    { message: `Extracting ${basename(pkgInfo.filePath)}` },
    async () => {
      await unzip(pkgInfo.filePath);
    },
  );

  // Find the installer JAR in the extracted files
  // The ZIP extracts to a subdirectory like "verapdf-greenfield-1.28.2/"
  const extractedDir = context.workingDir;
  let installerJar: string | undefined;

  for await (const entry of Deno.readDir(extractedDir)) {
    if (entry.isDirectory && entry.name.startsWith("verapdf-")) {
      // Look inside the extracted subdirectory for the JAR
      const subDir = join(extractedDir, entry.name);
      for await (const subEntry of Deno.readDir(subDir)) {
        if (subEntry.isFile && subEntry.name.endsWith(".jar")) {
          installerJar = join(subDir, subEntry.name);
          break;
        }
      }
      if (installerJar) break;
    } else if (entry.isFile && entry.name.endsWith(".jar")) {
      // JAR might be at the root level
      installerJar = join(extractedDir, entry.name);
      break;
    }
  }

  if (!installerJar) {
    context.error(
      "Could not find veraPDF installer JAR in the downloaded package",
    );
    return Promise.reject();
  }

  // Create auto-install.xml for headless installation
  // Panel IDs and pack names must match the IzPack installer configuration
  const autoInstallXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<AutomatedInstallation langpack="eng">
  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
  <com.izforge.izpack.panels.target.TargetPanel id="install_dir">
    <installpath>${targetDir}</installpath>
  </com.izforge.izpack.panels.target.TargetPanel>
  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
    <pack index="0" name="veraPDF GUI" selected="false"/>
    <pack index="1" name="veraPDF Mac and *nix Scripts" selected="true"/>
    <pack index="2" name="veraPDF Batch files" selected="true"/>
    <pack index="3" name="veraPDF Validation model" selected="true"/>
    <pack index="4" name="veraPDF Documentation" selected="false"/>
    <pack index="5" name="veraPDF Sample Plugins" selected="false"/>
  </com.izforge.izpack.panels.packs.PacksPanel>
  <com.izforge.izpack.panels.install.InstallPanel id="install"/>
  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>`;

  const autoInstallPath = join(extractedDir, "auto-install.xml");
  await Deno.writeTextFile(autoInstallPath, autoInstallXml);

  // Run the installer in headless mode
  // Pass the auto-install XML path directly to the installer
  await context.withSpinner(
    { message: "Installing veraPDF" },
    async () => {
      const result = await execProcess({
        cmd: "java",
        args: ["-jar", installerJar!, autoInstallPath],
        stdout: "piped",
        stderr: "piped",
      });

      if (!result.success) {
        const errorMsg = result.stderr || "Unknown error";
        throw new Error(`veraPDF installation failed: ${errorMsg}`);
      }
    },
  );

  // Note the installed version
  noteInstalledVersion(pkgInfo.version);
}

async function afterInstall(context: InstallContext): Promise<boolean> {
  if (context.flags[kUpdatePath]) {
    const dir = verapdfInstallDir();
    const verapdfBin = isWindows
      ? join(dir, "verapdf.bat")
      : join(dir, "verapdf");

    await context.withSpinner(
      { message: "Updating PATH" },
      async () => {
        await createToolSymlink(verapdfBin, "verapdf", context);
      },
    );

    // On Windows, a restart may be needed
    return isWindows;
  }

  return false;
}

async function uninstall(context: InstallContext): Promise<void> {
  // Remove symlinks if they exist
  if (context.flags[kUpdatePath]) {
    await removeToolSymlink("verapdf");
  }

  await context.withSpinner(
    { message: "Removing veraPDF" },
    async () => {
      const dir = verapdfInstallDir();
      if (existsSync(dir)) {
        safeRemoveSync(dir, { recursive: true });
      }
    },
  );
}
