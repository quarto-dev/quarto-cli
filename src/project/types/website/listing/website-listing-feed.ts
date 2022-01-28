/*
* website-listing-feed.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { warning } from "log/mod.ts";

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
import { dirAndStem } from "../../../../core/path.ts";

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
  source: string,
  project: ProjectContext,
  descriptors: ListingDescriptor[],
  options: ListingFeedOptions,
  format: Format,
) {
  // The path to the feed file
  const [dir, stem] = dirAndStem(source);
  const targetFile = options.type === "full"
    ? `${stem}.xml.staged`
    : `${stem}.xml`;
  const feedPath = join(dir, targetFile);

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

  // The feed files that have been generated
  const feedFiles: string[] = [];

  // Compute the file to write to
  await generateFeed(feed, feedItems, feedPath);

  feedFiles.push(feedPath);

  return feedFiles;
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
