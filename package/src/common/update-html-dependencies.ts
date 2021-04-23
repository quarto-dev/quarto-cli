/*
* bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { info } from "log/mod.ts";
import { join } from "path/mod.ts";

import { download, unzip } from "../util/utils.ts";
import { Configuration } from "./config.ts";

export async function updateHtmlDepedencies(config: Configuration) {
  info("Updating Bootstrap with version info:");

  // Read the version information from the environment
  const workingDir = Deno.makeTempDirSync();
  const bsVersion = Deno.env.get("BOOTSTRAP");
  if (!bsVersion) {
    throw new Error(`BOOTSTRAP is not defined`);
  }
  const bsIconVersion = Deno.env.get("BOOTSTRAP_FONT");
  if (!bsIconVersion) {
    throw new Error(`BOOTSTRAP_FONT is not defined`);
  }
  const bSwatchVersion = Deno.env.get("BOOTSWATCH_BRANCH");
  if (!bSwatchVersion) {
    throw new Error(`BOOTSWATCH_BRANCH is not defined`);
  }
  info(`Boostrap: ${bsVersion}`);
  info(`Boostrap Icon: ${bsIconVersion}`);
  info(`Bootswatch: ${bSwatchVersion}`);

  // the bootstrap and dist/themes dir
  const formatDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "html",
  );

  const bsDir = join(
    formatDir,
    "bootstrap",
  );

  const bsThemesDir = join(
    bsDir,
    "themes",
  );

  const bsDistDir = join(
    bsDir,
    "dist",
  );

  // Anchor
  await updateUnpkgDependency(
    "ANCHOR_JS",
    "anchor-js",
    "anchor.min.js",
    join(formatDir, "anchor", "anchor.min.js"),
  );

  // Poppper
  await updateUnpkgDependency(
    "POPPER_JS",
    "@popperjs/core",
    "dist/umd/popper.min.js",
    join(formatDir, "popper", "popper.min.js"),
  );

  // Clipboard
  await updateGithubSourceCodeDependency(
    "clipboardjs",
    "zenorocha/clipboard.js",
    "CLIPBOARD_JS",
    workingDir,
    (dir: string, version: string) => {
      // Copy the js file
      Deno.copyFileSync(
        join(dir, `clipboard.js-${version}`, "dist", "clipboard.min.js"),
        join(formatDir, "clipboard", "clipboard.min.js"),
      );
    },
  );

  // Tippy
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.umd.min.js",
    join(formatDir, "tippy", "tippy.umd.min.js"),
  );
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.css",
    join(formatDir, "tippy", "tippy.css"),
  );

  // Clean existing directories
  [bsThemesDir, bsDistDir].forEach((dir) => {
    if (existsSync(dir)) {
      Deno.removeSync(dir, { recursive: true });
    }
    ensureDirSync(dir);
  });

  // Update bootstrap
  await updateBootstrapDist(bsVersion, workingDir, bsDistDir);
  await updateBootstrapSass(bsVersion, workingDir, bsDistDir);
  await updateBoostrapIcons(bsIconVersion, workingDir, bsDistDir);
  await updateBootswatch(bSwatchVersion, workingDir, bsThemesDir);

  // Clean up the temp dir
  Deno.removeSync(workingDir, { recursive: true });
  info(
    "\n** Done- please commit any files that have been updated. **\n",
  );
}

async function updateBootswatch(
  version: string,
  working: string,
  themesDir: string,
) {
  info("Updating Bootswatch themes...");
  const fileName = `${version}.zip`;
  const distUrl =
    `https://github.com/thomaspark/bootswatch/archive/refs/heads/${fileName}`;
  const zipFile = join(working, fileName);
  const exclude = ["4"];

  // Download and unpack the source code
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Read each bootswatch theme directory and merge the scss files
  // into a single theme file for Quarto
  info("Merging themes:");
  const distPath = join(working, "bootswatch-5", "dist");
  for (const dirEntry of Deno.readDirSync(distPath)) {
    if (dirEntry.isDirectory && !exclude.includes(dirEntry.name)) {
      // this is a theme directory
      const theme = dirEntry.name;
      const themeDir = join(distPath, theme);

      info(`${theme}`);
      const layer = mergedSassLayer(
        join(themeDir, "_declarations.scss"),
        join(themeDir, "_variables.scss"),
        join(themeDir, "_bootswatch.scss"),
      );

      const themeOut = join(themesDir, `${theme}.scss`);
      Deno.writeTextFileSync(themeOut, layer);
    }
  }
  info("Done\n");
}

async function updateBootstrapSass(
  version: string,
  working: string,
  distDir: string,
) {
  info("Updating Bootstrap Scss Files...");

  const dirName = `bootstrap-${version}`;
  const fileName = `v${version}.zip`;
  const distUrl =
    `https://github.com/twbs/bootstrap/archive/refs/tags/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the bootstrap source code
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Move the scss directory from the source into our repo
  const from = join(working, dirName, "scss");
  const to = join(distDir, "scss");
  info(`Moving ${from} to ${to}`);
  Deno.renameSync(from, to);
}

async function updateBootstrapDist(
  version: string,
  working: string,
  distDir: string,
) {
  info("Updating Bootstrap Distribution Files...");

  const dirName = `bootstrap-${version}-dist`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/bootstrap/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the release
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Grab the js file that we need
  ["bootstrap.min.js"]
    .forEach((file) => {
      const from = join(working, dirName, "js", file);
      const to = join(distDir, file);
      info(`Copying ${from} to ${to}`);
      Deno.copyFileSync(
        from,
        to,
      );
    });

  info("Done\n");
}

async function updateBoostrapIcons(
  version: string,
  working: string,
  distDir: string,
) {
  info("Updating Bootstrap Icons...");
  const dirName = `bootstrap-icons-${version}`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/icons/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the release
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Copy the woff file
  Deno.copyFileSync(
    join(working, dirName, "fonts", "bootstrap-icons.woff"),
    join(distDir, "bootstrap-icons.woff"),
  );

  // Copy the css file, then fix it up
  const cssPath = join(distDir, "bootstrap-icons.css");
  Deno.copyFileSync(
    join(working, dirName, "bootstrap-icons.css"),
    cssPath,
  );
  fixupFontCss(cssPath);

  info("Done\n");
}

async function updateUnpkgDependency(
  versionEnvVar: string,
  pkg: string,
  filename: string,
  target: string,
) {
  const version = Deno.env.get(versionEnvVar);
  if (version) {
    const url = `https://unpkg.com/${pkg}@${version}/${filename}`;

    await download(url, target);
  } else {
    throw new Error(`${versionEnvVar} is not defined`);
  }
}

async function updateGithubSourceCodeDependency(
  name: string,
  repo: string,
  versionEnvVar: string,
  working: string,
  onDownload: (dir: string, version: string) => void,
) {
  info(`Updating ${name}...`);
  const version = Deno.env.get(versionEnvVar);
  if (version) {
    const fileName = `${name}.zip`;
    const distUrl =
      `https://github.com/${repo}/archive/refs/tags/v${version}.zip`;
    const zipFile = join(working, fileName);

    // Download and unzip the release
    info(`Downloading ${distUrl}`);
    await download(distUrl, zipFile);
    await unzip(zipFile, working);

    onDownload(working, version);
  } else {
    throw new Error(`${versionEnvVar} is not defined`);
  }

  info("Done\n");
}

function fixupFontCss(path: string) {
  let css = Deno.readTextFileSync(path);

  // Clear the woff2 reference
  const woff2Regex =
    /url\("\.\/fonts\/bootstrap-icons\.woff2.*format\("woff2"\),/;
  css = css.replace(woff2Regex, "");

  // Update the font reference to point to the local font
  const woffPathRegex = /url\("\.(\/fonts)\/bootstrap-icons\.woff\?/;
  css = css.replace(woffPathRegex, (substring: string) => {
    return substring.replace("/fonts", "");
  });

  Deno.writeTextFileSync(path, css);
}

function mergedSassLayer(
  declPath: string,
  varPath: string,
  rulesPath: string,
) {
  const merged: string[] = [];
  [{
    name: "declarations",
    path: declPath,
  }, {
    name: "variables",
    path: varPath,
  }, {
    name: "rules",
    path: rulesPath,
  }].forEach((part) => {
    const contents = existsSync(part.path)
      ? Deno.readTextFileSync(part.path)
      : undefined;
    if (contents) {
      merged.push(`/*-- scss:${part.name} --*/`);

      const inputLines = contents.split("\n");
      const outputLines: string[] = [];

      // This filters out any leading comments
      // in the theme file (which we think could be confusing
      // to users who are using these files as exemplars)
      let emit = false;
      inputLines.forEach((line) => {
        if (!line.startsWith("//")) {
          emit = true;
        }

        if (emit) {
          outputLines.push(line);
        }
      });

      merged.push(outputLines.join("\n"));
      merged.push("\n");
    }
  });
  return merged.join("\n");
}
