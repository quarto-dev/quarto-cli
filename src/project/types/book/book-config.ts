/*
* book-config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

import { safeExistsSync } from "../../../core/path.ts";
import { Metadata } from "../../../config/types.ts";

import {
  engineValidExtensions,
  fileExecutionEngine,
} from "../../../execute/engine.ts";
import { defaultWriterFormat } from "../../../format/formats.ts";

import {
  normalizeSidebarItem,
  partitionedMarkdownForInput,
  SidebarItem,
  SidebarTool,
} from "../../project-config.ts";
import { kProjectRender, ProjectConfig } from "../../types.ts";

import {
  isGithubRepoUrl,
  kContents,
  kImage,
  kOpenGraph,
  kSite,
  kSiteFooter,
  kSiteNavbar,
  kSitePageNavigation,
  kSitePath,
  kSiteRepoActions,
  kSiteRepoBranch,
  kSiteRepoUrl,
  kSiteSidebar,
  kSiteSidebarStyle,
  kSiteTitle,
  kSiteUrl,
  kTwitterCard,
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
  kOutputExt,
  kQuartoVarsKey,
  kTitle,
} from "../../../config/constants.ts";

import { binaryPath } from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";
import { texSafeFilename } from "../../../core/tex.ts";

const kAppendicesSectionLabel = "Appendices";

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
export const kBookAttribution = "attribution";

export const kBookItemChapter = "chapter";
export const kBookItemAppendix = "appendix";
export const kBookItemPart = "part";

export async function bookProjectConfig(
  projectDir: string,
  config: ProjectConfig,
  forceHtml: boolean,
) {
  // inherit website config behavior
  config = await websiteProjectConfig(projectDir, config, forceHtml);

  // ensure we have a site
  const site = (config[kSite] || {}) as Record<string, unknown>;
  config[kSite] = site;

  // copy some book config into site
  const book = config[kBook] as Record<string, unknown>;
  if (book) {
    site[kSiteTitle] = book[kSiteTitle];
    site[kSiteUrl] = book[kSiteUrl];
    site[kSitePath] = book[kSitePath];
    site[kSiteRepoUrl] = book[kSiteRepoUrl];
    site[kSiteRepoBranch] = book[kSiteRepoBranch];
    site[kSiteRepoActions] = book[kSiteRepoActions];
    site[kSiteNavbar] = book[kSiteNavbar];
    site[kSiteSidebar] = book[kSiteSidebar];
    site[kSitePageNavigation] = book[kSitePageNavigation] !== false;
    site[kOpenGraph] = book[kOpenGraph];
    site[kTwitterCard] = book[kTwitterCard];
    site[kImage] = book[kImage];

    // Conver the attribution markdown into html and place it into the footer
    const attributionMarkdown = book[kBookAttribution];
    if (attributionMarkdown && typeof (attributionMarkdown) === "string") {
      // render the markdown
      const markdown = await renderMarkdown(
        attributionMarkdown,
        kBookAttribution,
      );
      site[kSiteFooter] = markdown;
    }
  }

  // if we have a top-level 'contents' or 'appendix' fields fold into sidebar
  site[kSiteSidebar] = site[kSiteSidebar] || {};
  const siteSidebar = site[kSiteSidebar] as Metadata;
  siteSidebar[kSiteTitle] = book[kSiteTitle];
  siteSidebar[kSidebarLogo] = book[kSidebarLogo];

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
      .concat([{
        section: kAppendicesSectionLabel,
        contents: bookAppendix,
      }]);
  }

  // if search for book isn't false then enable search
  if (book[kBookSearch] !== false) {
    siteSidebar[kBookSearch] = true;
  }

  // set the sidebar to "floating" if it isn't already set
  siteSidebar[kSiteSidebarStyle] = siteSidebar[kSiteSidebarStyle] || "floating";

  // if we have tools then fold those into the sidebar
  siteSidebar[kBookTools] = siteSidebar[kBookTools] || [];
  if (book[kBookTools]) {
    (siteSidebar[kBookTools] as []).push(...book[kBookTools] as []);
  }

  // Prorcess the repo-url (github or journal-code)
  if (site[kSiteRepoUrl]) {
    const repoUrl = site[kSiteRepoUrl] as string;
    const icon = isGithubRepoUrl(repoUrl) ? "github" : "journal-code";
    (siteSidebar[kBookTools] as SidebarTool[]).push({
      text: "Source Code",
      icon,
      href: repoUrl,
    });
  }

  // Create any download tools
  (siteSidebar[kBookTools] as SidebarTool[]).push(
    ...(downloadTools(projectDir, config) || []),
  );

  // Create any sharing options
  (siteSidebar[kBookTools] as SidebarTool[]).push(
    ...(sharingTools(config) || []),
  );

  // save our own render list (which has more fine grained info about parts,
  // appendices, numbering, etc.) and popuplate the main config render list
  const renderItems = await bookRenderItems(projectDir, config);
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

  // Resolve any variables that appear in the title (since the title
  // may be used as things like file name in the case of a single file output)
  const title = book[kTitle];
  if (title !== undefined && typeof (title) === "string") {
    book[kTitle] = resolveVariables(title, config);
  }

  // return config
  return config;
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
  text?: string;
  file?: string;
  number?: number;
}

export async function bookRenderItems(
  projectDir: string,
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
  ) => {
    for (const item of items) {
      if (item.contents) {
        inputs.push({
          type: kBookItemPart,
          file: item.href,
          text: item.text,
        });
        await findInputs(type, item.contents);
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
            });
          }
        }
      }
    }
  };

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
          .map((item) => normalizeSidebarItem(projectDir, item)),
      );
    }
  };

  await findChapters(kBookChapters);

  const references = bookConfig("references", config);
  if (references) {
    await findInputs(kBookItemChapter, [
      normalizeSidebarItem(projectDir, references as SidebarItem),
    ]);
  }

  await findChapters(kBookAppendix, {
    type: kBookItemAppendix,
    text: kAppendicesSectionLabel + " {.unnumbered}",
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
    throw new Error(
      "Book contents must include a home page (e.g. index.md)",
    );
  }
  const index = inputs.splice(indexPos, 1);
  return index.concat(inputs);
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
  const chapterToItem = (chapter: BookChapterItem) => {
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
  };
  return chapters.map(chapterToItem);
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

  return texSafeFilename(outputFile);
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

async function renderMarkdown(markdown: string, keyname: string) {
  const result = await execProcess({
    cmd: [
      binaryPath("pandoc"),
      "--from",
      "markdown",
      "--to",
      "html",
    ],
    stdout: "piped",
  }, markdown);

  if (result.success) {
    return result.stdout;
  } else {
    throw new Error(
      `Invalid ${keyname} - please verify that the markdown is valid.`,
    );
  }
}

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
