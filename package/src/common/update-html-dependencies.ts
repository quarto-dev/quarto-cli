/*
 * bootstrap.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { ensureDir, ensureDirSync, existsSync, walkSync } from "fs/mod.ts";
import { copySync } from "fs/copy.ts";
import { info } from "../../../src/deno_ral/log.ts";
import { dirname, extname, join } from "../../../src/deno_ral/path.ts";
import { lines } from "../../../src/core/text.ts";
import * as ld from "../../../src/core/lodash.ts";

import { runCmd } from "../util/cmd.ts";
import { applyGitPatches, Repo, withRepo } from "../util/git.ts";

import { download } from "../util/utils.ts";
import { Configuration } from "./config.ts";
import { visitLines } from "../../../src/core/file.ts";
import { copyMinimal } from "../../../src/core/copy.ts";
import { kSourceMappingRegexes } from "../../../src/config/constants.ts";
import { unzip } from "../../../src/core/zip.ts";

export async function updateHtmlDependencies(config: Configuration) {
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
  const htmlToolsVersion = Deno.env.get("HTMLTOOLS");
  if (!htmlToolsVersion) {
    throw new Error("HTMLTOOLS is not defined");
  }

  info(`Boostrap: ${bsCommit}`);
  info(`Boostrap Icon: ${bsIconVersion}`);
  info(`Html Tools: ${htmlToolsVersion}`);

  // the bootstrap and dist/themes dir
  const formatDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "html"
  );

  const bsDir = join(formatDir, "bootstrap");

  const bsThemesDir = join(bsDir, "themes");

  const bsDistDir = join(bsDir, "dist");

  const htmlToolsDir = join(formatDir, "htmltools");
  const bslibDir = join(formatDir, "bslib");

  // For applying git patch to what we retreive
  const patchesDir = join(config.directoryInfo.pkg, "src", "common", "patches");

  function resolvePatches(patches: string[]) {
    return patches.map((patch) => {
      return join(patchesDir, patch);
    });
  }

  // Anchor
  const anchorJs = join(formatDir, "anchor", "anchor.min.js");
  await updateUnpkgDependency(
    "ANCHOR_JS",
    "anchor-js",
    "anchor.min.js",
    anchorJs
  );
  cleanSourceMap(anchorJs);

  // Poppper
  const popperJs = join(formatDir, "popper", "popper.min.js");
  await updateUnpkgDependency(
    "POPPER_JS",
    "@popperjs/core",
    "dist/umd/popper.min.js",
    popperJs
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
        clipboardJs
      );
      return Promise.resolve();
    }
  );
  cleanSourceMap(clipboardJs);

  // Day.js locales
  // https://github.com/iamkun/dayjs/tree/dev/src/locale
  const dayJsDir = join(
    config.directoryInfo.src,
    "resources",
    "library",
    "dayjs"
  );
  await updateGithubSourceCodeDependency(
    "dayjs",
    "iamkun/dayjs",
    "DAY_JS",
    workingDir,
    async (dir: string, version: string) => {
      const sourceDir = join(dir, `dayjs-${version}`, "src", "locale");
      const targetDir = join(dayJsDir, "locale");
      ensureDirSync(targetDir);

      const files = Deno.readDirSync(sourceDir);
      for (const file of files) {
        const targetFile = join(targetDir, file.name);
        // Move the file
        Deno.copyFileSync(join(sourceDir, file.name), targetFile);

        // Fixup the file to remove these lines
        const ignore = [
          "import dayjs from 'dayjs'",
          "dayjs.locale(locale, null, true)",
        ];
        info("Visiting lines of " + targetFile);
        const output: string[] = [];
        await visitLines(targetFile, (line: string | null, _count: number) => {
          if (line !== null) {
            if (!ignore.includes(line)) {
              output.push(line);
            }
          }
          return true;
        });

        Deno.writeTextFileSync(targetFile, output.join("\n"));
      }
    }
  );

  // Tippy
  const tippyUmdJs = join(formatDir, "tippy", "tippy.umd.min.js");
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.umd.min.js",
    tippyUmdJs
  );
  cleanSourceMap(tippyUmdJs);

  // List.js
  const listJs = join(
    config.directoryInfo.src,
    "resources",
    "projects",
    "website",
    "listing",
    "list.min.js"
  );
  await updateGithubSourceCodeDependency(
    "listjs",
    "javve/list.js",
    "LIST_JS",
    workingDir,
    (dir: string, version: string) => {
      ensureDirSync(dirname(listJs));
      // Copy the js file
      Deno.copyFileSync(
        join(dir, `list.js-${version}`, "dist", "list.min.js"),
        listJs
      );

      // Omit regular expression escaping
      // (Fixes https://github.com/quarto-dev/quarto-cli/issues/8435)
      const contents = Deno.readTextFileSync(listJs);
      const removeContent = /e=\(e=t\.utils\.toString\(e\)\.toLowerCase\(\)\)\.replace\(.*?\),/g
      const cleaned = contents.replaceAll(removeContent, "");
      Deno.writeTextFileSync(listJs, cleaned);

      return Promise.resolve();
    }
  );

  // Zenscroll
  const zenscrollJs = join(formatDir, "zenscroll", "zenscroll-min.js");
  await updateGithubSourceCodeDependency(
    "zenscroll",
    "zengabor/zenscroll",
    "ZENSCROLL_JS",
    workingDir,
    (dir: string, version: string) => {
      ensureDirSync(dirname(zenscrollJs));
      // Copy the js file
      Deno.copyFileSync(
        join(dir, `zenscroll-${version}`, "zenscroll-min.js"),
        zenscrollJs
      );
      return Promise.resolve();
    }
  );

  // Tippy
  const tippyCss = join(formatDir, "tippy", "tippy.css");
  await updateUnpkgDependency(
    "TIPPY_JS",
    "tippy.js",
    "dist/tippy.css",
    tippyCss
  );
  cleanSourceMap(tippyCss);

  // Glightbox
  const glightboxDir = join(formatDir, "glightbox");
  const glightBoxVersion = Deno.env.get("GLIGHTBOX_JS");;

  info("Updating glightbox");
  const basename = `glightbox-master`;
  const fileName = `${basename}.zip`;
  const distUrl = `https://github.com/biati-digital/glightbox/releases/download/${glightBoxVersion}/${fileName}`;
  const zipFile = join(workingDir, fileName);

  // Download and unzip the release
  const glightboxWorking = join(workingDir, "glightbox-master");
  ensureDirSync(glightboxWorking);

  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, glightboxWorking);

  // Remove extraneous files
  [
    {
      from: join("dist", "js", "glightbox.min.js"),
      to: "glightbox.min.js",
    },
    {
      from: join("dist", "css", "glightbox.min.css"),
      to: "glightbox.min.css",
    },
  ].forEach((depends) => {
    // Copy the js file
    Deno.copyFileSync(
      join(glightboxWorking, depends.from),
      join(glightboxDir, depends.to)
    );
  });
  info("");

  // Fuse
  const fuseJs = join(
    config.directoryInfo.src,
    "resources",
    "projects",
    "website",
    "search",
    "fuse.min.js"
  );
  await updateGithubSourceCodeDependency(
    "fusejs",
    "krisk/Fuse",
    "FUSE_JS",
    workingDir,
    (dir: string, version: string) => {
      // Copy the js file
      ensureDirSync(dirname(fuseJs));
      Deno.copyFileSync(
        join(dir, `Fuse-${version}`, "dist", "fuse.min.js"),
        fuseJs
      );
      return Promise.resolve();
    }
  );
  cleanSourceMap(fuseJs);

  // reveal.js
  const revealJs = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "revealjs",
    "reveal"
  );

  await updateGithubSourceCodeDependency(
    "reveal.js",
    "hakimel/reveal.js",
    "REVEAL_JS",
    workingDir,
    (dir: string, version: string) => {
      // Copy the desired resource files
      info("Copying reveal.js resources' directory");
      if (existsSync(revealJs)) {
        Deno.removeSync(revealJs, { recursive: true });
      }
      ensureDirSync(revealJs);

      info("Copying css/");
      copySync(join(dir, `reveal.js-${version}`, "css"), join(revealJs, "css"));
      info("Copying dist/");
      const dist = join(revealJs, "dist");
      copySync(join(dir, `reveal.js-${version}`, "dist"), dist);
      // remove unneeded CSS files
      const theme = join(dist, "theme");
      for (const fileEntry of Deno.readDirSync(theme)) {
        if (fileEntry.isFile && extname(fileEntry.name) === ".css") {
          info(`-> Removing unneeded ${fileEntry.name}.`);
          Deno.removeSync(join(theme, fileEntry.name));
        }
      }
      info("Copying plugin/");
      copySync(
        join(dir, `reveal.js-${version}`, "plugin"),
        join(revealJs, "plugin")
      );
      return Promise.resolve();
    },
    true,
    false
  );

  // revealjs-chalkboard
  const revealJsChalkboard = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "revealjs",
    "plugins",
    "chalkboard"
  );
  await updateGithubSourceCodeDependency(
    "reveal.js-chalkboard",
    "rajgoel/reveal.js-plugins",
    "REVEAL_JS_CHALKBOARD",
    workingDir,
    (dir: string, version: string) => {
      ensureDirSync(dirname(revealJsChalkboard));
      copyMinimal(
        join(dir, `reveal.js-plugins-${version}`, "chalkboard"),
        revealJsChalkboard
      );
      return Promise.resolve();
    },
    true // not a commit
  );

  // revealjs-menu
  const revealJsMenu = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "revealjs",
    "plugins",
    "menu"
  );
  await updateGithubSourceCodeDependency(
    "reveal.js-menu",
    "denehyg/reveal.js-menu",
    "REVEAL_JS_MENU",
    workingDir,
    (dir: string, version: string) => {
      // Copy the js file (modify to disable loadResource)
      ensureDirSync(revealJsMenu);
      const menuJs = Deno.readTextFileSync(
        join(dir, `reveal.js-menu-${version}`, "menu.js")
      ).replace(
        /function P\(e,t,n\).*?function M/,
        "function P(e,t,n){n.call()}function M"
      );
      Deno.writeTextFileSync(join(revealJsMenu, "menu.js"), menuJs);

      // copy the css file
      Deno.copyFileSync(
        join(dir, `reveal.js-menu-${version}`, "menu.css"),
        join(revealJsMenu, "menu.css")
      );

      // copy font-awesome to chalkboard
      copyMinimal(
        join(dir, `reveal.js-menu-${version}`, "font-awesome"),
        join(revealJsChalkboard, "font-awesome")
      );
      return Promise.resolve();
    },
    false, // not a commit
    false // no v prefix
  );

  // reveal-pdfexport
  const revealJsPdfExport = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "revealjs",
    "plugins",
    "pdfexport"
  );

  await updateGithubSourceCodeDependency(
    "reveal-pdfexport",
    "McShelby/reveal-pdfexport",
    "REVEAL_JS_PDFEXPORT",
    workingDir,
    (dir: string, version: string) => {
      ensureDirSync(revealJsPdfExport);
      Deno.copyFileSync(
        join(dir, `reveal-pdfexport-${version}`, "pdfexport.js"),
        join(revealJsPdfExport, "pdfexport.js")
      );
      return Promise.resolve();
    },
    false, // not a commit
    false, // no v prefix,
    resolvePatches([
      "0001-Patch-PdfExport-RevealJS-plugin-to-export-toggle-fun.patch",
    ])
  );

  // Github CSS (used for GFM HTML preview)
  const ghCSS = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "gfm",
    "github-markdown-css"
  );
  await updateGithubSourceCodeDependency(
    "github-markdown-css",
    "sindresorhus/github-markdown-css",
    "GITHUB_MARKDOWN_CSS",
    workingDir,
    (dir: string, version: string) => {
      ensureDirSync(ghCSS);
      const files = [
        "github-markdown-dark.css",
        "github-markdown-light.css",
        "github-markdown.css",
      ];
      files.forEach((file) => {
        // Copy the js file
        Deno.copyFileSync(
          join(dir, `github-markdown-css-${version}`, file),
          join(ghCSS, file)
        );
      });
      return Promise.resolve();
    }
  );

  // Autocomplete
  const autocompleteJs = join(
    config.directoryInfo.src,
    "resources",
    "projects",
    "website",
    "search",
    "autocomplete.umd.js"
  );
  await updateUnpkgDependency(
    "AUTOCOMPLETE_JS",
    "@algolia/autocomplete-js",
    "dist/umd/index.production.js",
    autocompleteJs
  );
  cleanSourceMap(autocompleteJs);

  // Autocomplete preset
  const autocompletePresetJs = join(
    config.directoryInfo.src,
    "resources",
    "projects",
    "website",
    "search",
    "autocomplete-preset-algolia.umd.js"
  );
  await updateUnpkgDependency(
    "AUTOCOMPLETE_JS",
    "@algolia/autocomplete-preset-algolia",
    "dist/umd/index.production.js",
    autocompletePresetJs
  );
  cleanSourceMap(autocompletePresetJs);

  // Update PDF JS
  await updatePdfJs(config, workingDir);

  // Cookie-Consent
  await updateCookieConsent(config, "4.0.0", workingDir);

  // Sticky table headers
  await updateStickyThead(config, workingDir);

  // Datatables and PDF Make
  await updateDatatables(config, workingDir);

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
    bslibDir
  );

  // Update Html Tools
  await updateHtmlTools(
    htmlToolsVersion,
    workingSubDir("htmltools"),
    htmlToolsDir
  )

  // Update Bootstrap icons
  await updateBoostrapIcons(bsIconVersion, workingSubDir("bsicons"), bsDistDir);

  // Update Pandoc themes
  await updatePandocHighlighting(config);

  //

  // Clean up the temp dir
  try {
    Deno.removeSync(workingDir, { recursive: true });
  } catch (_err) {
    info(`Folder not deleted - Remove manually: ${workingDir}`);
  }
  info("\n** Done- please commit any files that have been updated. **\n");
}

async function updatePdfJs(config: Configuration, working: string) {
  const version = Deno.env.get("PDF_JS");

  info("Updating pdf.js...");
  const basename = `pdfjs-${version}-legacy-dist`;
  const fileName = `${basename}.zip`;
  const distUrl = `https://github.com/mozilla/pdf.js/releases/download/v${version}/${fileName}`;
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
    "pdfjs"
  );
  copySync(from, to, { overwrite: true });
  info("Done\n");
}

async function updateCookieConsent(
  config: Configuration,
  version: string,
  working: string
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
    "cookie-consent"
  );
  await ensureDir(targetDir);

  await Deno.copyFile(tempPath, join(targetDir, fileName));
  info("Done\n");
}

async function updateDatatables(
  config: Configuration,
  working: string
) {
  // css: 
  // script: https://cdn.datatables.net/v/bs5/jszip-3.10.1/dt-1.13.8/b-2.4.2/b-html5-2.4.2/b-print-2.4.2/kt-2.11.0/r-2.5.0/datatables.min.js

  // pdfmake
  // https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js
  // https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js
  const datatablesConfig = Deno.env.get("DATATABLES_CONFIG");;
  const pdfMakeVersion = Deno.env.get("PDF_MAKE");;
  const dtFiles = ["datatables.min.css", "datatables.min.js"];
  const targetDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "dashboard",
    "js",
    "dt"
  );
  await ensureDir(targetDir);
  
  for (const file of dtFiles) {
    const url = `https://cdn.datatables.net/v/${datatablesConfig}/${file}`;
    const tempPath = join(working, file);
    info(`Downloading ${url}`);
    await download(url, tempPath);
    await Deno.copyFile(tempPath, join(targetDir, file));
  }

  const pdfMakeFiles = ["pdfmake.min.js", "vfs_fonts.js"];
  for (const file of pdfMakeFiles) {
    const url = `https://cdnjs.cloudflare.com/ajax/libs/pdfmake/${pdfMakeVersion}/${file}`;
    const tempPath = join(working, file);
    info(`Downloading ${url}`);
    await download(url, tempPath);
    await Deno.copyFile(tempPath, join(targetDir, file));
  }
  
  info("Done\n");
}

async function updateStickyThead(
  config: Configuration,
  working: string
) {
  const fileName = "stickythead.js";
  const url = `https://raw.githubusercontent.com/rohanpujaris/stickythead/master/dist/${fileName}`;
  const tempPath = join(working, fileName);

  info(`Downloading ${url}`);
  await download(url, tempPath);

  const targetDir = join(
    config.directoryInfo.src,
    "resources",
    "formats",
    "dashboard",
    "js"
  );
  await ensureDir(targetDir);

  await Deno.copyFile(tempPath, join(targetDir, fileName));
  info("Done\n");
}

async function updateHtmlTools(
  version: string,
  working: string,
  distDir: string
) {
  // https://github.com/rstudio/htmltools/archive/refs/tags/v0.5.6.zip
  info("Updating Html Tools...");
  const dirName = `htmltools-${version}`;
  const fileName = `v${version}.zip`;
  const distUrl = `https://github.com/rstudio/htmltools/archive/refs/tags/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the release
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Copy the fill css file
  ensureDirSync(distDir);
  Deno.copyFileSync(
    join(working, dirName, "inst", "fill", "fill.css"),
    join(distDir, "fill.css")
  );

  info("Done\n");
}

async function updateBootstrapFromBslib(
  commit: string,
  working: string,
  distDir: string,
  themesDir: string,
  bsLibDir: string
) {
  info("Updating Bootstrap Scss Files...");
  await withRepo(
    working,
    "https://github.com/rstudio/bslib.git",
    async (repo: Repo) => {
      // Checkout the appropriate version
      await repo.checkout(commit);

      // Build the required JS files
      info("Copying Components");

      // Get the components
      const componentsFrom = join(repo.dir, "inst", "components", "dist");
      const componentsTo = join(distDir, "components");
      const components = ["accordion", "card", "grid", "sidebar", "valuebox"];
      for (const component of components) {
        info(` - ${component}`);
        const componentDir = join(componentsTo, component);
        ensureDirSync(componentDir);

        const files = [
          `${component}.min.js`,
          `${component}.css`
        ];

        for (const file of files) {
          const fromPath = join(componentsFrom, component, file);
          if (existsSync(fromPath)) {
            const toPath = join(componentsTo, component, file);
            ensureDirSync(dirname(toPath));
            Deno.copyFileSync(fromPath, toPath);

            // Clean the source path
            cleanSourceMap(toPath);
          }
        }        
      }

      // Copy the scss files
      info("Copying scss files");
      const from = join(repo.dir, "inst", "lib", "bs5", "scss");
      const to = join(distDir, "scss");
      info(`Copying ${from} to ${to}`);
      copySync(from, to);

      // Fix up the Boostrap rules files
      info(
        "Rewriting bootstrap.scss to exclude functions, mixins, and variables."
      );
      const bootstrapFilter = [
        '@import "functions";',
        '@import "variables";',
        '@import "mixins";',
      ];
      const bootstrapScssFile = join(to, "bootstrap.scss");
      const bootstrapScssContents = lines(
        Deno.readTextFileSync(bootstrapScssFile)
      )
        .filter((line: string) => {
          return !bootstrapFilter.includes(line);
        })
        .join("\n");
      Deno.writeTextFileSync(bootstrapScssFile, bootstrapScssContents);
      info("done.");
      info("");

      // Rewrite the use of css `var()` style values to base SCSS values
      info("Rewriting _variables.scss file.");
      const bootstrapVariablesFile = join(to, "_variables.scss");
      const varContents = lines(Deno.readTextFileSync(bootstrapVariablesFile));
      const outLines: string[] = [];
      for (let line of varContents) {
        line = line.replaceAll(
          "var(--#{$prefix}font-sans-serif)",
          "$font-family-sans-serif"
        );
        line = line.replaceAll(
          "var(--#{$prefix}font-monospace)",
          "$font-family-monospace"
        );
        line = line.replaceAll(
          "var(--#{$prefix}success-rgb)",
          "$success"
        );
        line = line.replaceAll(
          "var(--#{$prefix}danger-rgb)",
          "$danger"
        );
        line = line.replaceAll(
          "var(--#{$prefix}body-color-rgb)",
          "$body-color"
        );
        line = line.replaceAll(
          "var(--#{$prefix}body-bg-rgb)",
          "$body-bg"
        );
        line = line.replaceAll(
          "var(--#{$prefix}emphasis-color-rgb)",
          "$body-emphasis-color"
        );
        line = line.replaceAll(
          /RGBA?\(var\(--#\{\$prefix\}emphasis-color-rgb,(.*?)\).*?\)/gm,
          "$body-emphasis-color"
        );        
        line = line.replaceAll(
          "var(--#{$prefix}secondary-color)",
          "$body-secondary-color"
        );
        line = line.replaceAll(
          "var(--#{$prefix}secondary-bg)",
          "$body-secondary-bg"
        );
        line = line.replaceAll(
          "var(--#{$prefix}tertiary-bg)",
          "$body-tertiary-bg"
        );
        line = line.replaceAll(
          "var(--#{$prefix}tertiary-color)",
          "$body-tertiary-color"
        );
        line = line.replaceAll(
          "var(--#{$prefix}emphasis-bg)",
          "$body-emphasis-bg"
        );
        line = line.replaceAll(
          "var(--#{$prefix}emphasis-color)",
          "$body-emphasis-color"
        );
        line = line.replaceAll(
          "$emphasis-color-rgb", 
          "$body-emphasis-color"
        );

        line = line.replaceAll(/var\(--#\{\$prefix\}(.*?)\)/gm, "$$$1");
        outLines.push(line);
      }
      Deno.writeTextFileSync(bootstrapVariablesFile, outLines.join("\n"));
      info("done.");
      info("");

      // Copy utils
      info("Copying scss files");
      const utilsFrom = join(repo.dir, "inst", "sass-utils");
      const utilsTo = join(distDir, "sass-utils");
      info(`Copying ${utilsFrom} to ${utilsTo}`);
      copySync(utilsFrom, utilsTo);

      // Copy bslib
      info("Copying BSLIB scss files");
      const bslibScssFrom = join(repo.dir, "inst", "bslib-scss");
      const bslibScssTo = join(bsLibDir, "bslib-scss");
      info(`Copying ${bslibScssFrom} to ${bslibScssTo}`);
      Deno.removeSync(bslibScssTo, { recursive: true});
      copySync(bslibScssFrom, bslibScssTo);

      // Copy componennts
      info("Copying BSLIB component scss files");
      const componentFrom = join(repo.dir, "inst", "components", "scss");
      const componentTo = join(bsLibDir, "components", "scss");
      info(`Copying ${componentFrom} to ${componentTo}`);
      copySync(componentFrom, componentTo, {overwrite: true});

      info("Copying BSLIB dist files");
      const componentDistFrom = join(repo.dir, "inst", "components", "dist");
      const componentDistTo = join(bsLibDir, "components", "dist");
      info(`Copying ${componentDistFrom} to ${componentDistTo}`);
      ensureDirSync(componentDistTo);
      copySync(componentDistFrom, componentDistTo, {overwrite: true});      
      // Clean map references
      for (const entry of walkSync(componentDistTo)) {
        if (entry.isFile) {
          cleanSourceMap(entry.path);
        }
      }

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
      ].forEach((file) => {
        const from = join(
          repo.dir,
          "inst",
          "lib",
          "bs5",
          "dist",
          "js",
          file.from
        );
        const to = join(distDir, file.to);
        info(`Copying ${from} to ${to}`);
        Deno.copyFileSync(from, to);
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
            join(themeDir, "_bootswatch.scss")
          );

          const patchedScss = patchTheme(theme, layer);

          const themeOut = join(themesDir, `${theme}.scss`);
          Deno.writeTextFileSync(themeOut, patchedScss);
        }
      }


      info("Done\n");
    }
  );
}

async function updateBoostrapIcons(
  version: string,
  working: string,
  distDir: string
) {
  info("Updating Bootstrap Icons...");
  const dirName = `bootstrap-icons-${version}`;
  const fileName = `${dirName}.zip`;
  const distUrl = `https://github.com/twbs/icons/releases/download/v${version}/${fileName}`;
  const zipFile = join(working, fileName);

  // Download and unzip the release
  info(`Downloading ${distUrl}`);
  await download(distUrl, zipFile);
  await unzip(zipFile, working);

  // Copy the woff file
  Deno.copyFileSync(
    join(working, dirName, "fonts", "bootstrap-icons.woff"),
    join(distDir, "bootstrap-icons.woff")
  );

  // Copy the css file, then fix it up
  const cssPath = join(distDir, "bootstrap-icons.css");
  Deno.copyFileSync(
    join(working, dirName, "bootstrap-icons.css"),
    cssPath
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
    "highlight-styles"
  );
  const pandoc =
    Deno.env.get("QUARTO_PANDOC") ||
    join(config.directoryInfo.bin, "tools", "pandoc");

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
              themeData
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
  target: string
) {
  const version = Deno.env.get(versionEnvVar);
  if (version) {
    info(`Updating ${pkg}...`);
    const url = `https://unpkg.com/${pkg}@${version}/${filename}`;

    info(`Downloading ${url} to ${target}`);
    ensureDirSync(dirname(target));
    await download(url, target);
    info("done\n");
  } else {
    throw new Error(`${versionEnvVar} is not defined`);
  }
}

/*
async function updateJsDelivrDependency(
  versionEnvVar: string,
  pkg: string,
  filename: string,
  target: string,
) {
  const version = Deno.env.get(versionEnvVar);
  if (version) {
    info(`Updating ${pkg}...`);
    const url = `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${filename}`;

    info(`Downloading ${url} to ${target}`);
    ensureDirSync(dirname(target));
    await download(url, target);
    info("done\n");
  } else {
    throw new Error(`${versionEnvVar} is not defined`);
  }
}
*/

async function updateGithubSourceCodeDependency(
  name: string,
  repo: string,
  versionEnvVar: string,
  working: string,
  onDownload: (dir: string, version: string) => Promise<void>,
  commit = false, // set to true when commit is used instead of a tag
  vPrefix = true, // set to false if github tags don't use a v prefix
  patches?: string[]
) {
  info(`Updating ${name}...`);
  const version = Deno.env.get(versionEnvVar)?.trim();
  if (version) {
    const fileName = `${name}.zip`;
    const distUrl = join(
      `https://github.com/${repo}/archive`,
      commit
        ? `${version}.zip`
        : `refs/tags/${vPrefix ? "v" : ""}${version}.zip`
    );
    const zipFile = join(working, fileName);

    // Download and unzip the release
    info(`Downloading ${distUrl}`);
    await download(distUrl, zipFile);
    await unzip(zipFile, working);

    await onDownload(working, version);
    if (patches) await applyGitPatches(patches);
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
      source
        .replaceAll(kSourceMappingRegexes[0], "")
        .replaceAll(kSourceMappingRegexes[1], "")
    );
  }
}

function mergedSassLayer(
  funcPath: string,
  defaultsPath: string,
  mixinsPath: string,
  rulesPath: string
) {
  const merged: string[] = [];
  [
    {
      name: "functions",
      path: funcPath,
    },
    {
      name: "defaults",
      path: defaultsPath,
    },
    {
      name: "mixins",
      path: mixinsPath,
    },
    {
      name: "rules",
      path: rulesPath,
    },
  ].forEach((part) => {
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

function patchTheme(themeName: string, themeContents: string) {
  const patches = themePatches[themeName];
  if (patches) {
    let patchedTheme = themeContents;
    patches.forEach((patch) => {
      if (patchedTheme.includes(patch.from)) {
        patchedTheme = patchedTheme.replace(patch.from, patch.to);
      } else {
        throw Error(
          `Unable to patch template ${themeName} because the target ${patch.from} cannot be found`
        );
      }
    });
    return patchedTheme;
  } else {
    return themeContents;
  }
}

interface ThemePatch {
  from: string;
  to: string;
}

const themePatches: Record<string, ThemePatch[]> = {
  litera: [
    {
      from: ".navbar {\n  font-size: $font-size-sm;",
      to: ".navbar {\n  font-size: $font-size-sm;\n  border: 1px solid rgba(0, 0, 0, .1);",
    },
  ],
  lumen: [
    {
      from: ".navbar {\n  @include shadow();",
      to: ".navbar {\n  @include shadow();\n  border-color: shade-color($navbar-bg, 10%);",
    }, 
    {
      from: "$nav-link-color:                    var(--#{$prefix}link-color) !default;",
      to: "$nav-link-color:                    $primary !default;"
    }
  ],
  simplex: [
    {
      from: ".navbar {\n  border-style: solid;\n  border-width: 1px;",
      to: ".navbar {\n  border-width: 1px;\n  border-style: solid;\n  border-color: shade-color($navbar-bg, 13%);",
    },
  ],
  solar: [
    {
      from: "$body-color:                $gray-600 !default;",
      to: "$body-color:                $gray-500 !default;",
    },
  ],
};
