/*
* bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDirSync, existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { download, unzip } from "../util/utils.ts";
import { Configuration } from "./config.ts";

export async function updateBootstrap(config: Configuration) {
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

  config.log.info("Updating Repo Dependencies:");
  config.log.info(`Boostrap: ${bsVersion}`);
  config.log.info(`Boostrap Icon: ${bsIconVersion}`);
  config.log.info(`Bootswatch: ${bSwatchVersion}`);

  const bsDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "html",
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

  [bsThemesDir, bsDistDir].forEach((dir) => {
    if (existsSync(dir)) {
      Deno.removeSync(dir, { recursive: true });
    }
    ensureDirSync(dir);
  });

  await updateBootstrapDist(bsVersion, config, workingDir, bsDistDir);
  await updateBootstrapSass(bsVersion, config, workingDir, bsDistDir);
  await updateBoostrapIcons(bsIconVersion, config, workingDir, bsDistDir);
  await updateBootswatch(bSwatchVersion, config, workingDir, bsThemesDir);
  updateBootstrapVersion(bsVersion, config);

  // Clean up the temp dir
  Deno.removeSync(workingDir, { recursive: true });

  config.log.info(
    "\n** Done- please commit any files that have been updated. **\n",
  );
}

async function updateBootswatch(
  version: string,
  config: Configuration,
  working: string,
  themesDir: string,
) {
  const fileName = `${version}.zip`;
  const distUrl =
    `https://github.com/thomaspark/bootswatch/archive/refs/heads/${fileName}`;
  const zipFile = join(working, fileName);
  const exclude = ["4"];

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  const distPath = join(working, "bootswatch-5", "dist");

  for (const dirEntry of Deno.readDirSync(distPath)) {
    if (dirEntry.isDirectory && !exclude.includes(dirEntry.name)) {
      // this is a theme directory
      const theme = dirEntry.name;
      const themeDir = join(distPath, theme);

      config.log.info(`Theme: ${theme}`);

      const layer = mergedSassLayer(
        join(themeDir, "_declarations.scss"),
        join(themeDir, "_variables.scss"),
        join(themeDir, "_bootswatch.scss"),
      );

      const themeOut = join(themesDir, `${theme}.scss`);
      Deno.writeTextFileSync(themeOut, layer);
    }
  }
}

async function updateBootstrapSass(
  version: string,
  config: Configuration,
  working: string,
  distDir: string,
) {
  const dirName = `bootstrap-${version}`;
  const fileName = `v${version}.zip`;
  const distUrl =
    `https://github.com/twbs/bootstrap/archive/refs/tags/${fileName}`;
  const zipFile = join(working, fileName);

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  const from = join(working, dirName, "scss");
  const to = join(distDir, "scss");
  config.log.info(`Moving ${from} to ${to}`);

  Deno.renameSync(from, to);
}

async function updateBootstrapDist(
  version: string,
  config: Configuration,
  working: string,
  distDir: string,
) {
  config.log.info("Updating Bootstrap...");

  const dirName = `bootstrap-${version}-dist`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/bootstrap/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  ["bootstrap.min.js"]
    .forEach((file) => {
      const from = join(working, dirName, "js", file);
      const to = join(distDir, file);
      config.log.info(`Copying ${from} to ${to}`);
      Deno.copyFileSync(
        from,
        to,
      );
    });

  config.log.info("Done Updating Bootstrap...\n");
}

async function updateBoostrapIcons(
  version: string,
  config: Configuration,
  working: string,
  distDir: string,
) {
  config.log.info("Updating Bootstrap Icons...");
  const dirName = `bootstrap-icons-${version}`;
  const fileName = `${dirName}.zip`;
  const distUrl =
    `https://github.com/twbs/icons/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  await download(distUrl, zipFile);

  await unzip(zipFile, working, config.log);

  Deno.copyFileSync(
    join(working, dirName, "fonts", "bootstrap-icons.woff"),
    join(distDir, "bootstrap-icons.woff"),
  );

  const cssPath = join(distDir, "bootstrap-icons.css");
  Deno.copyFileSync(
    join(working, dirName, "bootstrap-icons.css"),
    cssPath,
  );

  fixupFontCss(cssPath);

  config.log.info("Done Updating Bootstrap Icons...\n");
}

function updateBootstrapVersion(version: string, config: Configuration) {
  const srcPath = join(
    config.directoryInfo.src,
    "format",
    "html",
    "format-html-bootstrap.ts",
  );
  let src = Deno.readTextFileSync(srcPath);
  src = src.replace(
    /const kBootstrapVersion = ".*";/,
    `const kBootstrapVersion = "${version}";`,
  );
  Deno.writeTextFileSync(srcPath, src);
}

function fixupFontCss(path: string) {
  // Update the font reference to point to the local font
  let css = Deno.readTextFileSync(path);
  // Clear the woff2 reference
  const woff2Regex =
    /url\("\.\/fonts\/bootstrap-icons\.woff2.*format\("woff2"\),/;
  css = css.replace(woff2Regex, "");

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
  // TODO: strip leading comments from contents

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
      merged.push(`// theme:${part.name} `);

      const inputLines = contents.split("\n");
      const outputLines: string[] = [];

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
