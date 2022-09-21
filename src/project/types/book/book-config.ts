/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, join } from "path/mod.ts";

import * as ld from "../../../core/lodash.ts";

import { ensureTrailingSlash, safeExistsSync } from "../../../core/path.ts";
import { FormatLanguage, Metadata } from "../../../config/types.ts";

import {
  engineValidExtensions,
  fileExecutionEngine,
} from "../../../execute/engine.ts";
import { defaultWriterFormat } from "../../../format/formats.ts";

import { Navbar, SidebarItem, SidebarTool } from "../../types.ts";

import {
  normalizeSidebarItem,
  partitionedMarkdownForInput,
  sidebarContext,
} from "../../project-config.ts";
import { kProjectRender, ProjectConfig } from "../../types.ts";

import {
  kBodyFooter,
  kBodyHeader,
  kContents,
  kImage,
  kMarginFooter,
  kMarginHeader,
  kOpenGraph,
  kPageFooter,
  kSiteFavicon,
  kSiteNavbar,
  kSitePageNavigation,
  kSitePath,
  kSiteReaderMode,
  kSiteRepoActions,
  kSiteRepoBranch,
  kSiteRepoSubdir,
  kSiteRepoUrl,
  kSiteSidebar,
  kSiteSidebarStyle,
  kSiteTitle,
  kSiteUrl,
  kTwitterCard,
  kWebsite,
} from "../website/website-constants.ts";

import {
  repoUrlIcon,
  websiteConfigActions,
  websiteProjectConfig,
} from "../website/website-config.ts";

import { kSidebarLogo } from "../website/website-navigation.ts";

import {
  bookConfig,
  isBookIndexPage,
  isMultiFileBookFormat,
  isNumberedChapter,
  kBook,
} from "./book-shared.ts";
import {
  kLanguageDefaults,
  kOutputExt,
  kQuartoVarsKey,
  kSectionTitleAppendices,
  kTitle,
} from "../../../config/constants.ts";

import { texSafeFilename } from "../../../core/tex.ts";
import {
  kCookieConsent,
  kGoogleAnalytics,
} from "../website/website-analytics.ts";
import { RenderFlags } from "../../../command/render/types.ts";
import { formatLanguage } from "../../../core/language.ts";
import { kComments } from "../../../format/html/format-html-shared.ts";

export const kBookChapters = "chapters";
export const kBookAppendix = "appendices";
export const kBookReferences = "references";
export const kBookRender = "render";
export const kBookOutputFile = "output-file";
export const kBookRepoActions = "repo-actions";
export const kBookSharing = "sharing";
export const kBookDownloads = "downloads";
export const kBookTools = "tools";
export const kBookSearch = "search";

export const kBookItemChapter = "chapter";
export const kBookItemAppendix = "appendix";
export const kBookItemPart = "part";

export async function bookProjectConfig(
  projectDir: string,
  config: ProjectConfig,
  flags?: RenderFlags,
) {
  // ensure we have a site
  const site = (config[kWebsite] || {}) as Record<string, unknown>;
  config[kWebsite] = site;

  // copy some book config into site
  const book = config[kBook] as Record<string, unknown>;
  if (book) {
    site[kSiteTitle] = book[kSiteTitle];
    site[kSiteFavicon] = book[kSiteFavicon];
    site[kSiteUrl] = book[kSiteUrl];
    site[kSitePath] = book[kSitePath];
    site[kSiteRepoUrl] = book[kSiteRepoUrl];
    site[kSiteRepoSubdir] = book[kSiteRepoSubdir];
    site[kSiteRepoBranch] = book[kSiteRepoBranch];
    site[kSiteRepoActions] = book[kSiteRepoActions];
    site[kSiteNavbar] = book[kSiteNavbar];
    site[kSiteSidebar] = book[kSiteSidebar];
    site[kSitePageNavigation] = book[kSitePageNavigation] !== false;
    site[kOpenGraph] = book[kOpenGraph];
    site[kTwitterCard] = book[kTwitterCard];
    site[kImage] = book[kImage];
    site[kMarginHeader] = book[kMarginHeader];
    site[kMarginFooter] = book[kMarginFooter];
    site[kBodyHeader] = book[kBodyHeader];
    site[kBodyFooter] = book[kBodyFooter];
    site[kBookSearch] = book[kBookSearch];
    site[kSiteReaderMode] = book[kSiteReaderMode];
    site[kGoogleAnalytics] = book[kGoogleAnalytics];
    site[kCookieConsent] = book[kCookieConsent];
    site[kComments] = book[kComments];

    // If there is an explicitly set footer use that
    if (book[kPageFooter]) {
      site[kPageFooter] = book[kPageFooter];
    }
  }

  // resolve language
  const language = await formatLanguage(
    config,
    config[kLanguageDefaults] as FormatLanguage,
    flags,
  );

  // if we have a top-level 'contents' or 'appendix' fields fold into sidebar
  site[kSiteSidebar] = site[kSiteSidebar] || {};
  const siteSidebar = site[kSiteSidebar] as Metadata;
  siteSidebar[kSiteTitle] = siteSidebar[kSiteTitle] || book?.[kSiteTitle];
  siteSidebar[kSidebarLogo] = siteSidebar[kSidebarLogo] || book?.[kSidebarLogo];
  siteSidebar[kContents] = [];
  const bookContents = bookConfig(kBookChapters, config);

  if (Array.isArray(bookContents)) {
    siteSidebar[kContents] = bookChaptersToSidebarItems(
      bookContents as BookChapterItem[],
    );
  }
  const bookReferences = bookConfig(kBookReferences, config);
  if (bookReferences) {
    (siteSidebar[kContents] as unknown[]).push(bookReferences);
  }
  const bookAppendix = bookConfig(kBookAppendix, config);
  if (Array.isArray(bookAppendix)) {
    siteSidebar[kContents] = (siteSidebar[kContents] as unknown[])
      .concat([
        chapterToSidebarItem({
          part: language[kSectionTitleAppendices],
          chapters: bookAppendix as BookChapterItem[],
        }),
      ]);
  }

  // if search for book isn't false then enable search
  if (book?.[kBookSearch] !== false && siteSidebar[kBookSearch] !== false) {
    siteSidebar[kBookSearch] = true;
  }

  // set the sidebar to "floating" if it isn't already set
  siteSidebar[kSiteSidebarStyle] = siteSidebar[kSiteSidebarStyle] || "floating";

  // if we have tools then fold those into the sidebar

  // code tools
  const tools = [];
  if (site[kSiteRepoUrl]) {
    const repoUrl = siteRepoUrl(site);
    const icon = repoUrlIcon(repoUrl);
    tools.push({
      text: "Source Code",
      icon,
      href: repoUrl,
    });
  }
  tools.push(...(downloadTools(projectDir, config) || []));
  tools.push(...(sharingTools(config) || []));

  if (site[kSiteNavbar]) {
    (site[kSiteNavbar] as Navbar)[kBookTools] = tools;
  } else {
    siteSidebar[kBookTools] = siteSidebar[kBookTools] || [];
    (siteSidebar[kBookTools] as SidebarTool[]).push(...tools);
  }

  // save our own render list (which has more fine grained info about parts,
  // appendices, numbering, etc.) and popuplate the main config render list
  const renderItems = await bookRenderItems(projectDir, language, config);
  book[kBookRender] = renderItems;
  config.project[kProjectRender] = renderItems
    .filter((target) => !!target.file)
    .map((target) => target.file!);

  // add any 404 page we find
  const ext404 = engineValidExtensions().find((ext) =>
    existsSync(join(projectDir, `404${ext}`))
  );
  if (ext404) {
    config.project[kProjectRender]!.push(`404${ext404}`);
  }

  // return config (inherit website config behavior)
  return await websiteProjectConfig(projectDir, config);
}

function siteRepoUrl(site: Metadata) {
  const repoUrl = site[kSiteRepoUrl] as string;
  const branch = site[kSiteRepoBranch] || "main";
  if (site[kSiteRepoSubdir]) {
    const subdir = ensureTrailingSlash(site[kSiteRepoSubdir] as string);
    return `${ensureTrailingSlash(repoUrl)}tree/${branch}/${subdir}`;
  } else {
    return repoUrl;
  }
}

const variableRegex = /{{<\s*var\s+(.*?)\s*>}}/gm;
function resolveVariables(value: string, config: ProjectConfig) {
  variableRegex.lastIndex = 0;
  return value.replaceAll(variableRegex, (_: string, varName: string) => {
    const vars = config[kQuartoVarsKey] as Record<string, unknown>;
    if (vars && vars[varName] !== undefined) {
      return String(vars[varName]);
    } else {
      return `?var:${varName}`;
    }
  });
}

export function bookConfigRenderItems(
  project?: ProjectConfig,
): BookRenderItem[] {
  return bookConfig(
    kBookRender,
    project,
  ) as BookRenderItem[];
}

export type BookRenderItemType = "index" | "chapter" | "appendix" | "part";

export interface BookRenderItem {
  type: BookRenderItemType;
  depth: number;
  text?: string;
  file?: string;
  number?: number;
}

export async function bookRenderItems(
  projectDir: string,
  language: FormatLanguage,
  config?: ProjectConfig,
): Promise<BookRenderItem[]> {
  if (!config) {
    return [];
  }

  let nextNumber = 1;
  const inputs: BookRenderItem[] = [];

  const findInputs = async (
    type: BookRenderItemType,
    items: SidebarItem[],
    depth = 0,
  ) => {
    const throwInputNotFound = (input: string) => {
      throw new Error(`Book ${type} '${input}' not found`);
    };
    for (const item of items) {
      if (item.contents) {
        inputs.push({
          type: kBookItemPart,
          file: item.href,
          text: item.text,
          depth,
        });
        await findInputs(type, item.contents, depth + 1);
      } else if (item.href) {
        const itemPath = join(projectDir, item.href);
        if (safeExistsSync(itemPath)) {
          const engine = fileExecutionEngine(itemPath);
          if (engine) {
            // for chapters, check if we are numbered
            let number: number | undefined;

            if (
              type === kBookItemChapter &&
              await inputIsNumbered(projectDir, item.href)
            ) {
              number = nextNumber++;
            }

            // add the input
            inputs.push({
              type,
              file: item.href,
              number,
              depth,
            });
          }
        } else {
          throwInputNotFound(item.href);
        }
      } else if (item.text && !item.text.trim().match(/^-+$/)) {
        throwInputNotFound(item.text);
      }
    }
  };

  const context = sidebarContext();
  const findChapters = async (
    key: "chapters" | "appendices",
    delimiter?: BookRenderItem,
  ) => {
    nextNumber = 1;
    const bookInputs = bookConfig(key, config) as
      | Array<BookChapterItem>
      | undefined;
    if (bookInputs) {
      if (delimiter) {
        inputs.push(delimiter);
      }
      await findInputs(
        kBookItemChapter,
        bookChaptersToSidebarItems(bookInputs)
          .map((item) => normalizeSidebarItem(projectDir, item, context)),
        key === "chapters" ? 0 : 1, // next chapters under appendices, so start depth at level 1 (under appendix)
      );
    }
  };

  await findChapters(kBookChapters);

  const references = bookConfig("references", config);
  if (references) {
    await findInputs(kBookItemChapter, [
      normalizeSidebarItem(projectDir, references as SidebarItem, context),
    ]);
  }

  await findChapters(kBookAppendix, {
    type: kBookItemAppendix,
    text: language[kSectionTitleAppendices] + " {.unnumbered}",
    depth: 0,
  });

  // validate that all of the chapters exist
  const missing = inputs.filter((input) =>
    input.file && !existsSync(join(projectDir, input.file))
  );
  if (missing.length) {
    throw new Error(
      "Book contents file(s) do not exist: " + missing.join(", "),
    );
  }

  // find the index and place it at the front (error if no index)
  const indexPos = inputs.findIndex((input) => isBookIndexPage(input.file));
  if (indexPos === -1) {
    return inputs;
  } else {
    const index = inputs.splice(indexPos, 1);
    return index.concat(inputs);
  }
}

const kDownloadableItems: Record<string, { name: string; icon: string }> = {
  "epub": { name: "ePub", icon: "journal" },
  "pdf": { name: "PDF", icon: "file-pdf" },
  "docx": { name: "Docx", icon: "file-word" },
};

interface BookChapterItem extends SidebarItem {
  part?: string;
  chapters?: BookChapterItem[];
}

function bookChaptersToSidebarItems(chapters: BookChapterItem[]) {
  return chapters.map(chapterToSidebarItem);
}

function chapterToSidebarItem(chapter: BookChapterItem) {
  const item = ld.cloneDeep(chapter) as BookChapterItem;
  if (item.part) {
    item.section = item.part;
    delete item.part;
  }
  if (item.chapters) {
    item.contents = bookChaptersToSidebarItems(item.chapters);
    delete item.chapters;
  }
  return item;
}

function downloadTools(
  projectDir: string,
  config: ProjectConfig,
): SidebarTool[] | undefined {
  // Filter the user actions to the set that are single file books
  const downloadActions = websiteConfigActions("downloads", kBook, config);
  const filteredActions = downloadActions.filter((action) => {
    const format = defaultWriterFormat(action);
    if (format) {
      return format.extensions?.book && !isMultiFileBookFormat(format);
    } else {
      return false;
    }
  });

  // Map the action into sidebar items
  const outputStem = bookOutputStem(projectDir, config);
  const downloads = filteredActions.map((action) => {
    const format = defaultWriterFormat(action);
    const downloadItem = kDownloadableItems[action];
    if (downloadItem) {
      return {
        icon: downloadItem.icon,
        text: `Download ${downloadItem.name}`,
        href: `/${outputStem}.${format.render[kOutputExt]}`,
      };
    } else {
      return {
        text: `Download action}`,
        href: `/${outputStem}.${format.render[kOutputExt]}`,
      };
    }
  });

  // Form the menu (or single item download button)
  if (downloads.length === 0) {
    return undefined;
  } else if (downloads.length === 1) {
    return [{
      icon: "download",
      ...downloads[0],
    }];
  } else {
    return [{
      icon: "download",
      text: "Download",
      menu: downloads,
    }];
  }
}

export function bookOutputStem(projectDir: string, config?: ProjectConfig) {
  const outputFile = (bookConfig(kBookOutputFile, config) ||
    bookConfig(kTitle, config) || basename(projectDir)) as string;

  // Resolve any variables that appear in the title (since the title
  // may be used as things like file name in the case of a single file output)
  return texSafeFilename(
    config !== undefined ? resolveVariables(outputFile, config) : outputFile,
  );
}

function sharingTools(
  projectConfig: ProjectConfig,
): SidebarTool[] | undefined {
  const sharingActions = websiteConfigActions("sharing", kBook, projectConfig);

  // Filter the items to only the kinds that we know about
  const sidebarTools: SidebarTool[] = [];
  sidebarTools.push(
    ...sharingActions.filter((action) => {
      const sidebarTool = kSharingUrls[action];
      if (sidebarTool) {
        return true;
      } else {
        return false;
      }
    }).map((action) => {
      return kSharingUrls[action];
    }),
  );

  if (sidebarTools.length === 0) {
    return undefined;
  } else if (sidebarTools.length === 1) {
    // If there is one item, just return it
    return sidebarTools;
  } else {
    // If there are more than one items, make a menu
    return [{
      text: "Share",
      icon: kShareIcon,
      menu: sidebarTools,
    }];
  }
}

const kShareIcon = "share";
const kSharingUrls: Record<string, SidebarTool> = {
  linkedin: {
    icon: "linkedin",
    text: "LinkedIn",
    href: "https://www.linkedin.com/sharing/share-offsite/?url=|url|",
  },
  facebook: {
    icon: "facebook",
    text: "Facebook",
    url: "https://www.facebook.com/sharer/sharer.php?u=|url|",
  },
  twitter: {
    icon: "twitter",
    text: "Twitter",
    url: "https://twitter.com/intent/tweet?url=|url|",
  },
};

async function inputIsNumbered(
  projectDir: string,
  input: string,
) {
  const partitioned = await partitionedMarkdownForInput(projectDir, input);
  if (partitioned) {
    return isNumberedChapter(partitioned);
  } else {
    return false;
  }
}
