/*
* bootstrap.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/
import { ensureDir, ensureDirSync, existsSync, moveSync } from "fs/mod.ts";
import { info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { lines } from "../../../src/core/text.ts";
import { runCmd } from "../util/cmd.ts";
import { Repo, withRepo } from "../util/git.ts";

import { download, unzip } from "../util/utils.ts";
import { Configuration } from "./config.ts";

export async function updateHtmlDepedencies(config: Configuration) {
  info("Updating Bootstrap with version info:");

  // Read the version information from the environment
  const workingDir = Deno.makeTempDirSync();

  const bsCommit = Deno.env.get("BOOTSTRAP");
  if (!bsCommit) {
    throw new Error(`BOOTSTRAP is not defined`);
  }
  const bsIconVersion = Deno.env.get("BOOTSTRAP_FONT");
  if (!bsIconVersion) {
    throw new Error(`BOOTSTRAP_FONT is not defined`);
  }
  info(`Boostrap: ${bsCommit}`);
  info(`Boostrap Icon: ${bsIconVersion}`);

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
  const anchorJs = join(formatDir, "anchor", "anchor.min.js");
  await updateUnpkgDependency(
    "ANCHOR_JS",
    "anchor-js",
    "anchor.min.js",
    anchorJs,
  );
  cleanSourceMap(anchorJs);

  // Poppper
  const popperJs = join(formatDir, "popper", "popper.min.js");
  await updateUnpkgDependency(
    "POPPER_JS",
    "@popperjs/core",
    "dist/umd/popper.min.js",
    popperJs,
  );
  cleanSourceMap(popperJs);

  // Clipboard
  const clipboardJs = join(formatDir, "clipboard", "clipboard.min.js");
  await updateGithubSourceCodeDependency(
    "clipboardjs",
    "zenorocha/clipboard.js",
    "CLIPBOARD_JS",
    workingDir,
    (dir: string, version: string) => {
      // Copy the js file
      Deno.copyFileSync(
        join(dir, `clipboard.js-${version}`, "dist", "clipboard.min.js"),
        clipboardJs,
      );
    },
  );
  cleanSourceMap(clipboardJs);

  // Tippy
  const tippyUmdJs = join(formatDir, "tippy", "tippy.umd.min.js");
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.umd.min.js",
    tippyUmdJs,
  );
  cleanSourceMap(tippyUmdJs);

  const tippyJs = join(formatDir, "tippy", "tippy.css");
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.css",
    tippyJs,
  );
  cleanSourceMap(tippyJs);

  // Update PDF JS
  await updatePdfJs(
    config,
    workingDir,
  );

  // Cookie-Consent
  await updateCookieConsent(config, "4.0.0", workingDir);

  // Clean existing directories
  [bsThemesDir, bsDistDir].forEach((dir) => {
    if (existsSync(dir)) {
      Deno.removeSync(dir, { recursive: true });
    }
    ensureDirSync(dir);
  });

  const workingSubDir = (name: string) => {
    const dir = join(workingDir, name);
    ensureDirSync(dir);
    return dir;
  };

  // Update bootstrap
  await updateBootstrapFromBslib(
    bsCommit,
    workingSubDir("bsdist"),
    bsDistDir,
    bsThemesDir,
  );
  await updateBoostrapIcons(
    bsIconVersion,
    workingSubDir("bsicons"),
    bsDistDir,
  );

  // Update Pandoc themes
  await updatePandocHighlighting(config);

  // Clean up the temp dir
  Deno.removeSync(workingDir, { recursive: true });
  info(
    "\n** Done- please commit any files that have been updated. **\n",
  );
}

async function updatePdfJs(
  config: Configuration,
  working: string,
) {
  const version = Deno.env.get("PDF_JS");

  info("Updating pdf.js...");
  const basename = `pdfjs-${version}-legacy-dist`;
  const fileName = `${basename}.zip`;
  const distUrl =
    `https://github.com/mozilla/pdf.js/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the release
  const pdfjsDir = join(working, "pdfjs");
  ensureDirSync(pdfjsDir);

  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, pdfjsDir);

  // Remove extraneous files
  const removeFiles = ["web/compressed.tracemonkey-pldi-09.pdf"];
  removeFiles.forEach((file) => Deno.removeSync(join(pdfjsDir, file)));

  const from = pdfjsDir;
  const to = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "pdf",
    "pdfjs",
  );
  moveSync(from, to, { overwrite: true });
  info("Done\n");
}

async function updateCookieConsent(
  config: Configuration,
  version: string,
  working: string,
) {
  const fileName = "cookie-consent.js";
  const url = `https://www.cookieconsent.com/releases/${version}/${fileName}`;
  const tempPath = join(working, fileName);

  info(`Downloading ${url}`);
  await download(url, tempPath);

  const targetDir = join(
    config.directoryInfo.src,
    "resources",
    "projects",
    "website",
    "cookie-consent",
  );
  await ensureDir(targetDir);

  await Deno.copyFile(tempPath, join(targetDir, fileName));
}

async function updateBootstrapFromBslib(
  commit: string,
  working: string,
  distDir: string,
  themesDir: string,
) {
  info("Updating Bootstrap Scss Files...");
  await withRepo(
    working,
    "https://github.com/rstudio/bslib.git",
    async (repo: Repo) => {
      // Checkout the appropriate version
      await repo.checkout(commit);

      // Copy the scss files
      info("Copying scss files");
      const from = join(repo.dir, "inst", "lib", "bs5", "scss");
      const to = join(distDir, "scss");
      info(`Moving ${from} to ${to}`);
      Deno.renameSync(from, to);

      // Grab the js file that we need
      info("Copying dist files");
      [
        {
          from: "bootstrap.bundle.min.js",
          to: "bootstrap.min.js",
        },
        {
          from: "bootstrap.bundle.min.js.map",
          to: "bootstrap.min.js.map",
        },
      ]
        .forEach((file) => {
          const from = join(
            repo.dir,
            "inst",
            "lib",
            "bs5",
            "dist",
            "js",
            file.from,
          );
          const to = join(distDir, file.to);
          info(`Copying ${from} to ${to}`);
          Deno.copyFileSync(
            from,
            to,
          );
        });

      // Merge the bootswatch themes
      info("Merging themes:");
      const exclude = ["4"];
      const distPath = join(repo.dir, "inst", "lib", "bsw5", "dist");
      for (const dirEntry of Deno.readDirSync(distPath)) {
        if (dirEntry.isDirectory && !exclude.includes(dirEntry.name)) {
          // this is a theme directory
          const theme = dirEntry.name;
          const themeDir = join(distPath, theme);

          info(`${theme}`);
          const layer = mergedSassLayer(
            join(themeDir, "_functions.scss"),
            join(themeDir, "_variables.scss"),
            join(themeDir, "_mixins.scss"),
            join(themeDir, "_bootswatch.scss"),
          );

          const themeOut = join(themesDir, `${theme}.scss`);
          Deno.writeTextFileSync(themeOut, layer);
        }
      }
      info("Done\n");
    },
  );
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

async function updatePandocHighlighting(config: Configuration) {
  info("Updating Pandoc Highlighting Themes...");

  const highlightDir = join(
    config.directoryInfo.src,
    "resources",
    "pandoc",
    "highlight-styles",
  );
  const pandoc = join(config.directoryInfo.bin, "pandoc");

  // List  the styles
  const result = await runCmd(pandoc, ["--list-highlight-styles"]);
  if (result.status.success) {
    const highlightStyles = result.stdout;
    if (highlightStyles) {
      // Got through the list of styles and extract each style to our resources
      const styles = lines(highlightStyles);
      info(`Updating ${styles.length} styles...`);
      for (const style of styles) {
        if (style) {
          info(`-> ${style}...`);
          const themeResult = await runCmd(pandoc, [
            "--print-highlight-style",
            style,
          ]);

          if (themeResult.status.success) {
            const themeData = themeResult.stdout;
            await Deno.writeTextFile(
              join(highlightDir, `${style}.theme`),
              themeData,
            );
          }
        }
      }
    }
  }
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

// Cleans the source map declaration at the end of a JS file
function cleanSourceMap(path: string) {
  if (existsSync(path)) {
    const source = Deno.readTextFileSync(path);
    Deno.writeTextFileSync(
      path,
      source.replaceAll(/^\/\/#\s*sourceMappingURL\=.*\.map$/gm, ""),
    );
  }
}

function mergedSassLayer(
  funcPath: string,
  defaultsPath: string,
  mixinsPath: string,
  rulesPath: string,
) {
  const merged: string[] = [];
  [{
    name: "functions",
    path: funcPath,
  }, {
    name: "defaults",
    path: defaultsPath,
  }, {
    name: "mixins",
    path: mixinsPath,
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
