/*
* website-listing-feed.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join, relative } from "path/mod.ts";
import { warning } from "log/mod.ts";
import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";
import { existsSync } from "fs/mod.ts";

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
import {
  dirAndStem,
  expandPath,
  resolvePathGlobs,
} from "../../../../core/path.ts";
import { ProjectOutputFile } from "../../types.ts";
import { kListing } from "./website-listing-read.ts";

// Feed Options
/*

listing:
  feed:
    items: <number> || 20
    type: partial | full

Creates a listing composed of all the items in the current page, sorted by date



*/

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
  link: string;
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

  // Create feed metadata
  const feed: FeedMetadata = {
    title: feedTitle,
    description: feedDescription,
    link: siteUrl,
    generator: `quarto-${quartoConfig.version()}`,
    lastBuildDate: new Date().toUTCString(),
    language: options.language,
  };

  // Merge all the items
  const items: ListingItem[] = [];
  for (const descriptor of descriptors) {
    items.push(...descriptor.items);
  }

  // The path to the feed file
  const [dir, stem] = dirAndStem(source);
  const stagedPath = feedPath(dir, stem, options.type === "full");

  const finalPath = join(dir, `${stem}.xml`);
  const projectRelativeFinalPath = relative(project.dir, finalPath);

  // Add a link to the feed
  addLinkTagToDocument(doc, feed, projectRelativeFinalPath);

  // Categories to render
  const categoriesToRender = options[kFieldCategories]?.map((category) => {
    const finalRelPath = relative(
      project.dir,
      feedPath(dir, `${stem}-${category.toLocaleLowerCase()}`, false),
    );
    return {
      category,
      file: feedPath(
        dir,
        `${stem}-${category.toLocaleLowerCase()}`,
        options.type === "full",
      ),
      finalFile: finalRelPath,
    };
  });

  const feedFiles: string[] = [];
  // Render the main feed
  await renderFeed(feed, items, options, format, stagedPath);
  feedFiles.push(stagedPath);

  // Render the categories feed
  if (categoriesToRender) {
    for (const categoryToRender of categoriesToRender) {
      await renderCategoryFeed(
        doc,
        categoryToRender,
        feed,
        items,
        options,
        format,
      );
      feedFiles.push(categoryToRender.file);
    }
  }

  return feedFiles;
}

export function completeStagedFullFeeds(
  context: ProjectContext,
  outputFiles: ProjectOutputFile[],
  incremental: boolean,
) {
  outputFiles.forEach((outputFile) => {
    if (outputFile.format.metadata[kListing]) {
      // There is a listing here, look for unresolved feed files
      const [dir, stem] = dirAndStem(outputFile.file);
      const files = resolvePathGlobs(dir, [`${stem}*.${kStagedExt}`], []);
      for (const feedFile of files.include) {
        // TODO: Read and replace contents of the feed file
      }
    }
  });
}

const kStagedExt = "xml.staged";
const kFinalExt = "xml";

function feedPath(dir: string, stem: string, staged: boolean) {
  const ext = staged ? kStagedExt : kFinalExt;
  const file = `${stem}.${ext}`;
  return join(dir, file);
}

function addLinkTagToDocument(doc: Document, feed: FeedMetadata, path: string) {
  const linkEl = doc.createElement("link");
  linkEl.setAttribute("rel", "alternate");
  linkEl.setAttribute("type", "application/rss+xml");
  linkEl.setAttribute("title", feed.title);
  linkEl.setAttribute("href", path);
  doc.head.appendChild(linkEl);
}

async function renderCategoryFeed(
  doc: Document,
  categoryToRender: { category: string; file: string; finalFile: string },
  feed: FeedMetadata,
  items: ListingItem[],
  options: ListingFeedOptions,
  format: Format,
) {
  // Category title
  const feedMeta = { ...feed };
  feedMeta.title = `${feedMeta.title} - ${categoryToRender.category}`;

  const categoryItems = items.filter((item) => {
    const categories = item[kFieldCategories];
    if (categories) {
      return (categories as string[]).includes(categoryToRender.category);
    } else {
      return false;
    }
  });

  addLinkTagToDocument(doc, feedMeta, categoryToRender.finalFile);

  await renderFeed(
    feed,
    categoryItems,
    options,
    format,
    categoryToRender.file,
  );
}

async function renderFeed(
  feed: FeedMetadata,
  items: ListingItem[],
  options: ListingFeedOptions,
  format: Format,
  feedPath: string,
) {
  // Prepare the items to generate a feed
  const feedItems = prepareItems(items, options).map((item) => {
    const title = item.title || format.language[kUntitled];
    const link = item.path!;
    const description = item.description || "";
    const categories = (Array.isArray(item[kFieldCategories])
      ? item[kFieldCategories]
      : []) as string[];
    const authors = (Array.isArray(item[kFieldAuthor])
      ? item[kFieldAuthor]
      : []) as string[];
    const pubDate = item.date ? new Date(item.date) : new Date();

    return {
      title,
      link,
      description,
      categories,
      authors,
      guid: link,
      image: item[kFieldImage],
      pubDate,
    } as FeedItem;
  });

  // Compute the file to write to
  await generateFeed(feed, feedItems, feedPath);
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
