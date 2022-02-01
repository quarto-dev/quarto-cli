/*
* website-listing-feed.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import { Document, DOMParser, Element } from "deno_dom/deno-dom-wasm-noinit.ts";

import { uniqBy } from "../../../../core/lodash.ts";
import { Format } from "../../../../config/types.ts";
import { renderEjs } from "../../../../core/ejs.ts";
import { quartoConfig } from "../../../../core/quarto.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { ProjectContext } from "../../../types.ts";
import {
  websiteBaseurl,
  websiteDescription,
  websiteTitle,
} from "../website-config.ts";
import {
  kDescription,
  kFieldAuthor,
  kFieldCategories,
  kFieldImage,
  kItems,
  ListingDescriptor,
  ListingFeedOptions,
  ListingItem,
} from "./website-listing-shared.ts";
import { dirAndStem, resolvePathGlobs } from "../../../../core/path.ts";
import { ProjectOutputFile } from "../../types.ts";
import { kListing } from "./website-listing-read.ts";
import { resolveInputTarget } from "../../../project-index.ts";
import {
  defaultSyntaxHighlightingClassMap,
} from "../../../../command/render/pandoc-html.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { imageContentType, imageSize } from "../../../../core/image.ts";

// TODO: Localize
const kUntitled = "untitled";

export const kDefaultItems = 20;

interface FeedImage {
  title: string;
  url: string;
  link?: string;
  height?: number;
  description?: string;
}

interface FeedMetadata {
  title: string;
  link: string; // links to the page that is hosting the feed
  feedLink: string; // links to the feed itself (for example to provide atom with a link)
  description: string;
  image?: FeedImage;
  language?: string;

  generator: string;
  lastBuildDate: string;
}

interface FeedItem {
  title: string;
  link: string;
  description: string;

  categories?: string[];
  authors?: string[];
  guid: string;
  pubDate: Date;
  image?: string;
  imageHeight?: string;
  imageWidth?: string;
  imageContentType?: string;
}

export async function createFeed(
  doc: Document,
  source: string,
  project: ProjectContext,
  descriptors: ListingDescriptor[],
  options: ListingFeedOptions,
  format: Format,
) {
  // First, be sure that we have a site URL, otherwise we can't
  // create a valid feed
  const siteUrl = websiteBaseurl(project.config);
  if (!siteUrl) {
    // There is no `site-url`
    warning(
      "Unable to create a feed as the required `site-url` property is missing from this project.",
    );
    return;
  }

  // Find the feed metadata
  const feedTitle = options.title || websiteTitle(project.config) ||
    format.language[kUntitled] as string;
  const feedDescription = options.description ||
    format.metadata[kDescription] as string ||
    websiteDescription(project.config) || format.language[kUntitled] as string;

  // Form the path to this document
  const projectRelInput = relative(project.dir, source);
  const inputTarget = await resolveInputTarget(project, projectRelInput, false);

  const [dir, stem] = dirAndStem(source);
  const finalRelPath = relative(
    project.dir,
    join(dir, `${stem}.xml`),
  );

  // Create feed metadata
  const feed: FeedMetadata = {
    title: feedTitle,
    description: feedDescription,
    link: `${siteUrl}/${inputTarget?.outputHref}`,
    feedLink: `${siteUrl}/${finalRelPath}`,
    generator: `quarto-${quartoConfig.version()}`,
    lastBuildDate: new Date().toUTCString(),
    language: options.language,
  };

  // Merge all the items
  const items: ListingItem[] = [];
  for (const descriptor of descriptors) {
    items.push(...descriptor.items);
  }

  // The core feed file is generated 'staged' with placeholders for
  // content that should be replaced with rendered version of the content
  // from fully rendered documents.
  const stagedPath = feedPath(dir, stem, options.type === "full");

  const feedFiles: string[] = [];

  // Render the main feed
  const rendered = await renderFeed(
    siteUrl,
    feed,
    items,
    options,
    project,
    stagedPath,
  );
  if (rendered) {
    // Add a link to the feed
    // But we should put the correct unstaged / final link in the document
    const finalPath = join(dir, `${stem}.xml`);
    const projectRelativeFinalPath = relative(project.dir, finalPath);
    feedFiles.push(stagedPath);
    addLinkTagToDocument(doc, feed, projectRelativeFinalPath);
  }

  // Categories to render
  const categoriesToRender = options[kFieldCategories]?.map((category) => {
    const finalRelPath = relative(
      project.dir,
      join(dir, `${stem}-${category.toLocaleLowerCase()}.xml`),
    );
    return {
      category,
      file: feedPath(
        dir,
        `${stem}-${category.toLocaleLowerCase()}`,
        options.type === "full",
      ),
      finalFile: finalRelPath,
      feedLink: `${siteUrl}/${finalRelPath}`,
    };
  });

  // Render the categories feed
  if (categoriesToRender) {
    for (const categoryToRender of categoriesToRender) {
      const rendered = await renderCategoryFeed(
        siteUrl,
        categoryToRender,
        feed,
        items,
        options,
        project,
      );

      if (rendered) {
        addLinkTagToDocument(doc, feed, categoryToRender.finalFile);
        feedFiles.push(categoryToRender.file);
      }
    }
  }

  return feedFiles;
}

export function completeStagedFeeds(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  _incremental: boolean,
) {
  // Go through any output files and fix up any feeds associated with them
  outputFiles.forEach((outputFile) => {
    // Does this output file contain a listing?
    if (outputFile.format.metadata[kListing]) {
      // There is a listing here, look for unresolved feed files
      const [dir, stem] = dirAndStem(outputFile.file);

      // Any feed files for this output file
      const files = resolvePathGlobs(dir, [`${stem}${kStagedFileGlob}`], []);

      // Go through each of the feed files and replace any placeholders
      // with content from the rendered documents
      const siteUrl = websiteBaseurl(context.config);
      if (siteUrl === undefined) {
        throw new Error(
          "Unexpectedly asked to complete staged feed for a project without a `site-url`!",
        );
      }
      const contentReader = renderedContentReader(context, siteUrl!);

      for (const feedFile of files.include) {
        // Info about this feed file
        const [feedDir, feedStem] = dirAndStem(feedFile);

        // Whether the staged file should be filled with full contents of the file
        const fullContents = feedFile.endsWith(kFullStagedExt);

        // Read the staged file contents and replace any
        // content with the rendered version from the document
        let feedContents = Deno.readTextFileSync(feedFile);
        const tagWithReplacements = [
          {
            tag: "title",
            regex: kTitleRegex,
            replaceValue: (rendered: RenderedContents) => {
              return rendered.title;
            },
          },
          {
            tag: "description",
            regex: kDescRegex,
            replaceValue: (rendered: RenderedContents) => {
              if (fullContents) {
                return `<![CDATA[ ${rendered.fullContents} ]]>`;
              } else {
                return `<![CDATA[ ${rendered.firstPara} ]]>`;
              }
            },
          },
        ];

        tagWithReplacements.forEach((tagWithReplacement) => {
          const regex = tagWithReplacement.regex;
          const tag = tagWithReplacement.tag;
          regex.lastIndex = 0;

          let match = regex.exec(feedContents);
          while (match) {
            const relativePath = match[1];
            const absolutePath = join(feedDir, relativePath);
            const contents = contentReader(absolutePath);

            const replaceStr = placholderForReplace(tag, relativePath);
            if (contents.title) {
              feedContents = feedContents.replace(
                replaceStr,
                `<${tag}>${tagWithReplacement.replaceValue(contents)}</${tag}>`,
              );
            }
            match = regex.exec(feedContents);
          }
          regex.lastIndex = 0;
        });

        // Move the completed feed to its final location
        Deno.writeTextFileSync(
          join(feedDir, `${feedStem}.${kFinalExt}`),
          feedContents,
        );
        Deno.removeSync(feedFile);
      }
    }
  });
}

async function renderCategoryFeed(
  siteUrl: string,
  categoryToRender: {
    category: string;
    file: string;
    finalFile: string;
    feedLink: string;
  },
  feed: FeedMetadata,
  items: ListingItem[],
  options: ListingFeedOptions,
  project: ProjectContext,
) {
  // Category title
  const feedMeta = { ...feed };

  // Add the category filter
  feedMeta.link = feedMeta.link + "#category=" +
    encodeURI(categoryToRender.category);
  feedMeta.title = `${feedMeta.title} - ${categoryToRender.category}`;
  feedMeta.feedLink = categoryToRender.feedLink;

  const categoryItems = items.filter((item) => {
    const categories = item[kFieldCategories];
    if (categories) {
      return (categories as string[]).includes(categoryToRender.category);
    } else {
      return false;
    }
  });

  return await renderFeed(
    siteUrl,
    feedMeta,
    categoryItems,
    options,
    project,
    categoryToRender.file,
  );
}

async function renderFeed(
  siteUrl: string,
  feed: FeedMetadata,
  items: ListingItem[],
  options: ListingFeedOptions,
  project: ProjectContext,
  feedPath: string,
) {
  // Prepare the items to generate a feed
  const feedItems: FeedItem[] = [];

  for (const item of prepareItems(items, options)) {
    const inputTarget = await resolveInputTarget(project, item.path!, false);

    // Core feed item
    const title = inputTarget?.outputHref
      ? placeholder(inputTarget?.outputHref)
      : "";
    const link = `${siteUrl}${inputTarget?.outputHref}`;
    const description = inputTarget?.outputHref
      ? placeholder(inputTarget?.outputHref)
      : "";
    const pubDate = item.date ? new Date(item.date) : new Date();
    const feedItem: FeedItem = {
      title,
      link,
      description,
      guid: link,
      pubDate,
    };

    // Categories
    if (Array.isArray(item[kFieldCategories])) {
      feedItem.categories = item[kFieldCategories];
    }

    // Author
    if (Array.isArray(item[kFieldAuthor])) {
      feedItem.authors = item[kFieldAuthor];
    }

    // Image Data
    if (item[kFieldImage]) {
      feedItem.image = absoluteUrl(siteUrl, item[kFieldImage]);
      const imagePath = join(project.dir, item[kFieldImage]);
      feedItem.imageContentType = imageContentType(imagePath);
      const size = imageSize(imagePath);
      if (size) {
        feedItem.imageHeight = size.height.toString();
        feedItem.imageWidth = size.width.toString();
      }
    }
    feedItems.push(feedItem);
  }

  if (feedItems.length > 0) {
    // Compute the file to write to
    await generateFeed(feed, feedItems, feedPath);
    return true;
  } else {
    return false;
  }
}

async function generateFeed(
  feed: FeedMetadata,
  feedItems: FeedItem[],
  path: string,
) {
  const feedFile = await Deno.open(path, {
    write: true,
    create: true,
  });
  const textEncoder = new TextEncoder();

  const preamble = renderEjs(
    resourcePath("projects/website/listing/feed/preamble.ejs.md"),
    {
      feed,
    },
  );
  await Deno.write(feedFile.rid, textEncoder.encode(preamble));

  for (const feedItem of feedItems) {
    const item = renderEjs(
      resourcePath("projects/website/listing/feed/item.ejs.md"),
      {
        item: feedItem,
      },
    );
    await Deno.write(feedFile.rid, textEncoder.encode(item));
  }

  // Render the postamble
  const postamble = renderEjs(
    resourcePath("projects/website/listing/feed/postamble.ejs.md"),
    {
      feed,
    },
  );
  await Deno.write(feedFile.rid, textEncoder.encode(postamble));
}

function prepareItems(items: ListingItem[], options: ListingFeedOptions) {
  const validItems = items.filter((item) => {
    // TODO: Should we warn or error when we skip an item that doesn't have a path
    return (item.title !== undefined && item.path !== undefined);
  });

  const uniqueItems = uniqBy(validItems, (item: ListingItem) => {
    return item.path;
  });

  const sortedItems = uniqueItems.sort((a: ListingItem, b: ListingItem) => {
    const aTimestamp = a.date ? new Date(a.date).valueOf() : -1;
    const bTimestamp = b.date ? new Date(b.date).valueOf() : -1;
    return aTimestamp - bTimestamp;
  });

  const itemCount = (options[kItems] || kDefaultItems);
  if (sortedItems.length > itemCount) {
    return sortedItems.slice(0, itemCount);
  } else {
    return sortedItems;
  }
}

function addLinkTagToDocument(doc: Document, feed: FeedMetadata, path: string) {
  const linkEl = doc.createElement("link");
  linkEl.setAttribute("rel", "alternate");
  linkEl.setAttribute("type", "application/rss+xml");
  linkEl.setAttribute("title", feed.title);
  linkEl.setAttribute("href", path);
  doc.head.appendChild(linkEl);
}

const kFullStagedExt = "feed-full-staged";
const kPartialStageExt = "feed-partial-staged";
const kFinalExt = "xml";
const kStagedFileGlob = "*.feed-*-staged";

function placeholder(outputHref: string) {
  return `{B4F502887207:${outputHref}}`;
}

function placholderForReplace(tag: string, outputHref: string) {
  return `<${tag}>{B4F502887207\:${outputHref}}<\/${tag}>`;
}

// Regular expressions that we'll use to find unresolved content
const kTitleRegex = tagplaceholderRegex("title");
const kDescRegex = tagplaceholderRegex("description");

function tagplaceholderRegex(tag: string) {
  return new RegExp(`<${tag}>{B4F502887207\:(.*?)}<\/${tag}>`, "gm");
}

function feedPath(dir: string, stem: string, full: boolean) {
  const ext = full ? kFullStagedExt : kPartialStageExt;
  const file = `${stem}.${ext}`;
  return join(dir, file);
}

interface RenderedContents {
  title: string | undefined;
  firstPara: string | undefined;
  fullContents: string | undefined;
}

const renderedContentReader = (project: ProjectContext, siteUrl: string) => {
  const renderedContent: Record<string, RenderedContents> = {};
  return (filePath: string): RenderedContents => {
    if (!renderedContent[filePath]) {
      renderedContent[filePath] = readRenderedContents(
        filePath,
        siteUrl,
        project,
      );
    }
    return renderedContent[filePath];
  };
};

function readRenderedContents(
  filePath: string,
  siteUrl: string,
  project: ProjectContext,
): RenderedContents {
  const htmlInput = Deno.readTextFileSync(filePath);
  const doc = new DOMParser().parseFromString(htmlInput, "text/html")!;

  const fileRelPath = relative(projectOutputDir(project), filePath);
  const fileRelFolder = dirname(fileRelPath);

  const mainEl = doc.querySelector("main.content");

  // Capture the rendered title and remove it from the content
  const titleEl = doc.getElementById("title-block-header");
  const titleText = titleEl?.querySelector("h1.title")?.innerText;
  if (titleEl) {
    titleEl.remove();
  }

  // Remove any navigation elements from the content region
  const navEls = doc.querySelectorAll("nav");
  if (navEls) {
    for (const navEl of navEls) {
      navEl.remove();
    }
  }

  // Convert any images to have absolute paths
  const imgNodes = doc.querySelectorAll("img");
  if (imgNodes) {
    for (const imgNode of imgNodes) {
      const imgEl = imgNode as Element;
      let src = imgEl.getAttribute("src");
      if (src) {
        if (!src.startsWith("/")) {
          src = join(fileRelFolder, src);
        }
        imgEl.setAttribute("src", absoluteUrl(siteUrl, src));
      }
    }
  }

  // Strip unacceptable elements
  const stripSelectors = [
    '*[aria-hidden="true"]', // Feeds should not contain aria hidden elements
    "button.code-copy-button", // Code copy buttons looks weird and don't work
  ];
  stripSelectors.forEach((sel) => {
    const nodes = doc.querySelectorAll(sel);
    nodes?.forEach((node) => {
      node.remove();
    });
  });

  // Strip unacceptable attributes
  const stripAttrs = [
    "role",
  ];
  stripAttrs.forEach((attr) => {
    const nodes = doc.querySelectorAll(`[${attr}]`);
    nodes?.forEach((node) => {
      const el = node as Element;
      el.removeAttribute(attr);
    });
  });

  // String unacceptable links
  const relativeLinkSel = 'a[href^="#"]';
  const linkNodes = doc.querySelectorAll(relativeLinkSel);
  linkNodes.forEach((linkNode) => {
    const nodesToMove = linkNode.childNodes;
    linkNode.after(...nodesToMove);
    linkNode.remove();
  });

  // Process code to apply styles for syntax highlighting
  const highlightingMap = defaultSyntaxHighlightingClassMap();
  const spanNodes = doc.querySelectorAll("code span");
  for (const spanNode of spanNodes) {
    const spanEl = spanNode as Element;

    for (const clz of spanEl.classList) {
      const styles = highlightingMap[clz];
      if (styles) {
        spanEl.setAttribute("style", styles.join("\n"));
        break;
      }
    }
  }

  // Process math using webtex
  const trimMath = (str: string) => {
    // Text of math is prefixed by the below
    if (str.length > 4 && (str.startsWith("\\[") || str.startsWith("\\("))) {
      const trimStart = str.slice(2);
      return trimStart.slice(0, trimStart.length - 2);
    } else {
      return str;
    }
  };

  const mathNodes = doc.querySelectorAll("span.math");
  for (const mathNode of mathNodes) {
    const mathEl = mathNode as Element;
    const math = trimMath(mathEl.innerText);
    const imgEl = doc.createElement("IMG");
    imgEl.setAttribute(
      "src",
      kWebTexUrl(math),
    );
    mathNode.parentElement?.replaceChild(imgEl, mathNode);
  }

  return {
    title: titleText,
    fullContents: mainEl?.innerHTML,
    firstPara: mainEl?.querySelector("p")?.innerHTML,
  };
}

const kWebTexUrl = (
  math: string,
  type: "png" | "svg" | "gif" | "emf" | "pdf" = "png",
) => {
  const encodedMath = encodeURI(math);
  return `https://latex.codecogs.com/${type}.latex?${encodedMath}`;
};

const absoluteUrl = (siteUrl: string, url: string) => {
  if (url.startsWith("http:") || url.startsWith("https:")) {
    return url;
  } else {
    return `${siteUrl}/${url}`;
  }
};
