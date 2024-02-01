/*
 * website-sitemap.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { basename, join, relative } from "path/mod.ts";

import { ElementInfo, SAXParser } from "xmlp/mod.ts";

import { ProjectContext } from "../../types.ts";
import { projectOutputDir } from "../../project-shared.ts";
import { pathWithForwardSlashes, removeIfExists } from "../../../core/path.ts";

import { renderEjs } from "../../../core/ejs.ts";
import { resourcePath } from "../../../core/resources.ts";

import { ProjectOutputFile } from "../types.ts";
import { websiteBaseurl } from "./website-config.ts";
import { copyTo } from "../../../core/copy.ts";
import {
  inputFileForOutputFile,
  inputTargetIndexForOutputFile,
  inputTargetIsEmpty,
  resolveInputTargetForOutputFile,
} from "../../project-index.ts";
import { isDraftVisible, projectDraftMode } from "./website-utils.ts";

export async function updateSitemap(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  // get output dir
  const outputDir = projectOutputDir(context);

  // filter out empty index files
  const filteredOutputFiles: ProjectOutputFile[] = [];
  for (const outputFile of outputFiles) {
    if (basename(outputFile.file) === "index.html") {
      const index = await inputTargetIndexForOutputFile(
        context,
        relative(outputDir, outputFile.file),
      );
      if (index && inputTargetIsEmpty(index)) {
        continue;
      }
    }
    filteredOutputFiles.push(outputFile);
  }
  outputFiles = filteredOutputFiles;

  // see if we have a robots.txt to copy
  const robotsTxtPath = join(context.dir, "robots.txt");
  const srcRobotsTxt = existsSync(robotsTxtPath) ? robotsTxtPath : undefined;
  const destRobotsTxt = join(outputDir, "robots.txt");
  if (srcRobotsTxt) {
    copyTo(srcRobotsTxt, destRobotsTxt);
  }

  const baseUrlConfig = websiteBaseurl(context.config);
  const sitemapPath = join(outputDir, "sitemap.xml");
  if (typeof baseUrlConfig === "string") {
    // normalize baseUrl
    let baseUrl = baseUrlConfig as string;
    if (!baseUrl.endsWith("/")) {
      baseUrl += "/";
    }

    // helper to create a urlset entry
    const fileLoc = (file: string) =>
      baseUrl + pathWithForwardSlashes(relative(outputDir, file));

    const fileLastMod = (file: string) =>
      (Deno.statSync(file).mtime || new Date(0))
        .toISOString();

    const inputModified = async (output: string, project: ProjectContext) => {
      const inputFile = await inputFileForOutputFile(project, output);
      if (inputFile) {
        return fileLastMod(inputFile.file);
      } else {
        return fileLastMod(output);
      }
    };

    const isDraft = async (outputFile: ProjectOutputFile) => {
      const index = await resolveInputTargetForOutputFile(
        context,
        relative(outputDir, outputFile.file),
      );
      return index ? index.draft : undefined;
    };

    const urlsetEntry = async (outputFile: ProjectOutputFile) => {
      const file = outputFile.file;
      return {
        loc: fileLoc(file),
        lastmod: await inputModified(file, context),
        draft: await isDraft(outputFile),
      };
    };

    const draftMode = projectDraftMode(context);

    // full render or no existing sitemap creates a fresh sitemap.xml
    if (!incremental || !existsSync(sitemapPath)) {
      // write sitemap
      const urlset: Urlset = [];
      for (const file of outputFiles) {
        urlset.push(await urlsetEntry(file));
      }
      writeSitemap(sitemapPath, urlset, draftMode);
    } else { // otherwise parse the sitemap, update and write a new one
      const urlSet: Urlset = await readSitemap(sitemapPath);
      for (const outputFile of outputFiles) {
        const file = outputFile.file;
        const loc = fileLoc(file);
        const url = urlSet.find((url) => url.loc === loc);
        if (url) {
          url.lastmod = await inputModified(file, context);
          url.draft = await isDraft(outputFile);
        } else {
          urlSet.push(await urlsetEntry(outputFile));
        }
      }
      writeSitemap(sitemapPath, urlSet, draftMode);
    }

    // create robots.txt if necessary
    if (!srcRobotsTxt) {
      const robotsTxt = `Sitemap: ${baseUrl}sitemap.xml\n`;
      if (
        !existsSync(destRobotsTxt) ||
        (Deno.readTextFileSync(destRobotsTxt) !== robotsTxt)
      ) {
        Deno.writeTextFileSync(destRobotsTxt, robotsTxt);
      }
    }
  } else {
    removeIfExists(sitemapPath);
  }
}

type Urlset = Array<{ loc: string; lastmod: string; draft?: boolean }>;

async function readSitemap(sitemapPath: string): Promise<Urlset> {
  const urlset = new Array<{ loc: string; lastmod: string }>();
  const parser = new SAXParser();
  let loc: string | undefined;
  let lastmod: string | undefined;
  parser.on("text", (text: string, element: ElementInfo) => {
    if (element.qName === "loc") {
      loc = text;
    } else if (element.qName == "lastmod") {
      lastmod = text;
    }
  });
  parser.on("end_element", (element: ElementInfo) => {
    if (element.qName === "url" && loc && lastmod) {
      urlset.push({ loc, lastmod });
    }
  });
  const reader = await Deno.open(sitemapPath);
  await parser.parse(reader);
  reader.close();
  return urlset;
}

function writeSitemap(sitemapPath: string, urlset: Urlset, draftMode: string) {
  const nonDraftUrls = urlset.filter((url) =>
    !url.draft || isDraftVisible(draftMode)
  );
  const sitemap = renderEjs(
    resourcePath(
      join("projects", "website", "templates", "sitemap.ejs.xml"),
    ),
    { urlset: nonDraftUrls },
  );
  Deno.writeTextFileSync(sitemapPath, sitemap);
}
