/*
 * website-listing-feed.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

import { uniqBy } from "../../../../core/lodash.ts";
import { Format } from "../../../../config/types.ts";
import { renderEjs } from "../../../../core/ejs.ts";
import { escape } from "../../../../core/lodash.ts";
import { quartoConfig } from "../../../../core/quarto.ts";
import { resourcePath } from "../../../../core/resources.ts";
import { ProjectContext } from "../../../types.ts";
import { kImage } from "../website-constants.ts";
import {
  websiteBaseurl,
  websiteDescription,
  websiteImage,
  websiteTitle,
} from "../website-config.ts";
import {
  absoluteUrl,
  kDescription,
  kFieldAuthor,
  kFieldCategories,
  kFieldImage,
  kInlineCodeStyle,
  kItems,
  kListing,
  kUrlsToAbsolute,
  kXmlStyleSheet,
  ListingDescriptor,
  ListingFeedOptions,
  ListingItem,
  RenderedContentOptions,
  renderedContentReader,
  RenderedContents,
} from "./website-listing-shared.ts";
import { dirAndStem, resolvePathGlobs } from "../../../../core/path.ts";
import { ProjectOutputFile } from "../../types.ts";
import { resolveInputTarget } from "../../../project-index.ts";
import { projectOutputDir } from "../../../project-shared.ts";
import { imageContentType, imageSize } from "../../../../core/image.ts";
import { warnOnce } from "../../../../core/log.ts";
import { isHtmlOutput } from "../../../../config/format.ts";

export const kDefaultItems = 20;

interface FeedImage {
  title: string;
  url: string;
  link?: string;
  height?: number;
  width?: number;
  description?: string;
}

interface FeedMetadata {
  title: string;
  link: string; // links to the page that is hosting the feed
  feedLink: string; // links to the feed itself (for example to provide atom with a link)
  description: string;
  image?: FeedImage;
  language?: string;
  [kXmlStyleSheet]?: string;

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
  imageHeight?: number;
  imageWidth?: number;
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

  const feedTitle = options.title || websiteTitle(project.config);
  if (!feedTitle) {
    // There is no `title`
    warning(
      "Unable to create a feed as the required `site > title` property is missing from this project.",
    );
    return;
  }

  // Find the feed metadata
  const feedDescription = options.description ||
    format.metadata[kDescription] as string ||
    websiteDescription(project.config) || "";

  // Form the path to this document
  const projectRelInput = relative(project.dir, source);
  const inputTarget = await resolveInputTarget(project, projectRelInput, false);

  const [dir, stem] = dirAndStem(source);
  const finalRelPath = relative(
    project.dir,
    join(dir, `${stem}.xml`),
  );

  const link = absoluteUrl(siteUrl, inputTarget?.outputHref!);
  const feedLink = absoluteUrl(siteUrl, finalRelPath);

  // Merge all the items
  const items: ListingItem[] = [];
  for (const descriptor of descriptors) {
    items.push(...descriptor.items);
  }
  const filteredItems = prepareItems(items, options);

  // Find the most recent item (if any)
  const mostRecent = mostRecentItem(filteredItems);

  const xmlSheetHref = options[kXmlStyleSheet]
    ? absoluteUrl(siteUrl, options[kXmlStyleSheet])
    : undefined;

  // Create feed metadata
  const feed: FeedMetadata = {
    title: feedTitle,
    description: feedDescription,
    link,
    feedLink,
    generator: `quarto-${quartoConfig.version()}`,
    lastBuildDate: (mostRecent && mostRecent.date)
      ? new Date(mostRecent.date).toUTCString()
      : new Date().toUTCString(),
    language: options.language,
    [kXmlStyleSheet]: xmlSheetHref,
  };

  // Add any image metadata
  const image = options.image || format.metadata[kImage] as string ||
    websiteImage(project.config);
  if (image) {
    feed.image = {
      title: feedTitle,
      link: link,
      url: absoluteUrl(siteUrl, image),
    };
    const size = imageSize(image);
    if (size) {
      const [height, width] = feedImageSize(size.height, size.width);
      feed.image.height = height;
      feed.image.width = width;
    }
  }

  // The core feed file is generated 'staged' with placeholders for
  // content that should be replaced with rendered version of the content
  // from fully rendered documents.
  const stagedPath = feedPath(dir, stem, options.type);

  const feedFiles: string[] = [];

  // Push any stylesheet
  if (options[kXmlStyleSheet]) {
    feedFiles.push(options[kXmlStyleSheet]);
  }

  // Render the main feed
  const rendered = await renderFeed(
    siteUrl,
    feed,
    filteredItems,
    project,
    stagedPath,
  );
  if (rendered) {
    // Add a link to the feed
    // But we should put the correct unstaged / final link in the document
    feedFiles.push(stagedPath);
    addLinkTagToDocument(doc, feed, `${stem}.xml`);
  }

  // Categories to render
  options[kFieldCategories] = options[kFieldCategories] || [];
  const feedCategories = Array.isArray(options[kFieldCategories])
    ? options[kFieldCategories] as string[]
    : [options[kFieldCategories] as string];
  const categoriesToRender = feedCategories?.map((category) => {
    const finalRelPath = relative(
      project.dir,
      join(dir, `${stem}-${category.toLocaleLowerCase()}.xml`),
    );
    return {
      category,
      file: feedPath(
        dir,
        `${stem}-${category.toLocaleLowerCase()}`,
        options.type,
      ),
      finalFile: finalRelPath,
      feedLink: absoluteUrl(siteUrl, finalRelPath),
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
        feedFiles.push(categoryToRender.file);
      }
    }
  }

  return feedFiles;
}

const kFeedOptions: RenderedContentOptions = {
  remove: {
    anchors: true,
  },
  transform: {
    [kUrlsToAbsolute]: true,
    [kInlineCodeStyle]: true,
    math: true,
  },
};

export function completeStagedFeeds(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  _incremental: boolean,
) {
  // Go through each of the feed files and replace any placeholders
  // with content from the rendered documents
  const siteUrl = websiteBaseurl(context.config);
  if (siteUrl !== undefined) {
    // Go through any output files and fix up any feeds associated with them
    outputFiles.forEach((outputFile) => {
      // Does this output file contain a listing?
      if (
        outputFile.format.metadata[kListing] &&
        isHtmlOutput(outputFile.format.pandoc, true)
      ) {
        // There is a listing here, look for unresolved feed files
        const [dir, stem] = dirAndStem(outputFile.file);

        // Any feed files for this output file
        const files = resolvePathGlobs(dir, [`${stem}${kStagedFileGlob}`], []);

        const contentReader = renderedContentReader(
          context,
          kFeedOptions,
          siteUrl,
        );

        for (const feedFile of files.include) {
          // Info about this feed file
          const [feedDir, feedStem] = dirAndStem(feedFile);

          try {
            // Whether the staged file should be filled with full contents of the file
            const type = feedFile.endsWith(kFullStagedExt)
              ? "full"
              : feedFile.endsWith(kPartialStagedExt)
              ? "partial"
              : "metadata";

            // Read the staged file contents and replace any
            // content with the rendered version from the document
            let feedContents = Deno.readTextFileSync(feedFile);
            const tagWithReplacements = [
              {
                tag: "title",
                regex: kTitleRegex,
                replaceValue: (rendered: RenderedContents) => {
                  if (rendered.title) {
                    return escape(rendered.title);
                  } else {
                    return "";
                  }
                },
              },
              {
                tag: "description",
                regex: kDescRegex,
                replaceValue: (rendered: RenderedContents) => {
                  if (type === "full") {
                    return `<![CDATA[ ${rendered.fullContents} ]]>`;
                  } else if (type === "partial") {
                    return `<![CDATA[ ${
                      rendered.description || rendered.firstPara
                    } ]]>`;
                  } else {
                    return `<![CDATA[ ${rendered.description || ""} ]]>`;
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
                const absolutePath = relativePath.startsWith("/")
                  ? join(projectOutputDir(context), relativePath)
                  : join(feedDir, relativePath);
                const contents = contentReader(absolutePath);
                if (contents) {
                  const targetStr = placholderForReplace(tag, relativePath);
                  feedContents = feedContents.replace(
                    targetStr,
                    () => {
                      return `<${tag}>${
                        tagWithReplacement.replaceValue(contents)
                      }</${tag}>`;
                    },
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
          } catch (error) {
            const errorMessage = error.message;
            warnOnce(
              `Unable to generate feed '${feedStem}.xml'\n${errorMessage}`,
            );
          } finally {
            try {
              Deno.removeSync(feedFile);
            } catch {
              // Just ignore this and move on
            }
          }
        }
      }
    });
  }
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
  const categoryItems = items.filter((item) => {
    const categories = item[kFieldCategories];
    if (categories) {
      return (categories as string[]).includes(categoryToRender.category);
    } else {
      return false;
    }
  });
  const filteredItems = prepareItems(categoryItems, options);

  // Category title
  const feedMeta = { ...feed };

  // Add the category filter
  feedMeta.link = feedMeta.link + "#category=" +
    encodeURI(categoryToRender.category);
  feedMeta.feedLink = categoryToRender.feedLink;
  if (feedMeta.image) {
    feedMeta.image.link = feedMeta.link;
    feedMeta.image.title = feedMeta.title;
  }

  // Find the most recent item (if any)
  const mostRecent = mostRecentItem(filteredItems);
  feedMeta.lastBuildDate = (mostRecent && mostRecent.date)
    ? new Date(mostRecent.date).toUTCString()
    : new Date().toUTCString();

  return await renderFeed(
    siteUrl,
    feedMeta,
    filteredItems,
    project,
    categoryToRender.file,
  );
}

async function renderFeed(
  siteUrl: string,
  feed: FeedMetadata,
  items: ListingItem[],
  project: ProjectContext,
  feedPath: string,
) {
  // Prepare the items to generate a feed
  const feedItems: FeedItem[] = [];

  for (const item of items) {
    const inputTarget = await resolveInputTarget(project, item.path!, false);

    // Core feed item
    const title = inputTarget?.outputHref
      ? placeholder(inputTarget?.outputHref)
      : item.title || "";
    const link = absoluteUrl(siteUrl, inputTarget?.outputHref || "");
    const description = inputTarget?.outputHref
      ? placeholder(inputTarget?.outputHref)
      : item.description || "";
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
      feedItem.categories = item[kFieldCategories] as string[];
    }

    // Author
    if (Array.isArray(item[kFieldAuthor])) {
      feedItem.authors = item[kFieldAuthor];
    }

    // Image Data
    if (item[kFieldImage] && typeof (item[kFieldImage] === "string")) {
      const image = item[kFieldImage] as string;
      feedItem.image = absoluteUrl(siteUrl, image);
      const imagePath = join(project.dir, image);
      feedItem.imageContentType = imageContentType(imagePath);
      const size = imageSize(imagePath);
      if (size) {
        const [height, width] = feedImageSize(size.height, size.width);
        feedItem.imageHeight = height;
        feedItem.imageWidth = width;
      }
    }
    feedItems.push(feedItem);
  }

  // Compute the file to write to
  await generateFeed(feed, feedItems, feedPath);
  return true;
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
  try {
    const textEncoder = new TextEncoder();

    const preamble = renderEjs(
      resourcePath("projects/website/listing/feed/preamble.ejs.md"),
      {
        feed,
        escape,
      },
    );
    await Deno.write(feedFile.rid, textEncoder.encode(preamble));

    for (const feedItem of feedItems) {
      const item = renderEjs(
        resourcePath("projects/website/listing/feed/item.ejs.md"),
        {
          item: feedItem,
          escape,
        },
      );
      await Deno.write(feedFile.rid, textEncoder.encode(item));
    }

    // Render the postamble
    const postamble = renderEjs(
      resourcePath("projects/website/listing/feed/postamble.ejs.md"),
      {
        feed,
        escape,
      },
    );
    await Deno.write(feedFile.rid, textEncoder.encode(postamble));
  } finally {
    Deno.close(feedFile.rid);
  }
}

function prepareItems(items: ListingItem[], options: ListingFeedOptions) {
  const validItems = items.filter((item) => {
    return (item.title !== undefined && item.path !== undefined);
  });

  const uniqueItems = uniqBy(validItems, (item: ListingItem) => {
    return item.path;
  });

  const sortedItems = uniqueItems.sort((a: ListingItem, b: ListingItem) => {
    const aTimestamp = a.date ? new Date(a.date).valueOf() : -1;
    const bTimestamp = b.date ? new Date(b.date).valueOf() : -1;
    return bTimestamp - aTimestamp;
  });

  const itemCount = options[kItems] || kDefaultItems;
  if (sortedItems.length > itemCount) {
    return sortedItems.slice(0, itemCount);
  } else {
    return sortedItems;
  }
}

function mostRecentItem(items: ListingItem[]) {
  const sortedItems = items.sort((a, b) => {
    const aTime = a.date ? a.date.getTime() : 0;
    const bTime = b.date ? b.date.getTime() : 0;
    return bTime - aTime;
  });

  const mostRecentItem = sortedItems.length > 0 ? sortedItems[0] : undefined;
  return mostRecentItem;
}

function addLinkTagToDocument(doc: Document, feed: FeedMetadata, path: string) {
  const linkEl = doc.createElement("link");
  linkEl.setAttribute("rel", "alternate");
  linkEl.setAttribute("type", "application/rss+xml");
  linkEl.setAttribute("title", feed.title);
  linkEl.setAttribute("href", path);
  linkEl.setAttribute("data-external", "1");
  doc.head.appendChild(linkEl);
}

const kFullStagedExt = "feed-full-staged";
const kPartialStagedExt = "feed-partial-staged";
const kMetadataStagedExt = "feed-metadata-staged";
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

function feedPath(
  dir: string,
  stem: string,
  type: "full" | "partial" | "metadata",
) {
  const ext = type === "full"
    ? kFullStagedExt
    : type === "partial"
    ? kPartialStagedExt
    : kMetadataStagedExt;
  const file = `${stem}.${ext}`;
  return join(dir, file);
}

// See https://validator.w3.org/feed/docs/rss2.html#ltimagegtSubelementOfLtchannelgt
const kMaxWidth = 144;
const kMaxHeight = 400;

const feedImageSize = (height: number, width: number) => {
  const heightScale = kMaxHeight / height;
  const widthScale = kMaxWidth / width;
  if (heightScale >= 1 && widthScale >= 1) {
    return [height, width];
  } else {
    const scaleFactor = heightScale < widthScale ? heightScale : widthScale;
    return [
      Math.round(height * scaleFactor),
      Math.round(width * scaleFactor),
    ];
  }
};
