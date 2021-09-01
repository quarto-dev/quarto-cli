/*
* website-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { Document, Element } from "deno_dom/deno-dom-wasm.ts";
import { dirname, join, relative } from "path/mod.ts";
import {
  kDescription,
  kPageTitle,
  kSubtitle,
  kTitle,
  kTitlePrefix,
} from "../../../config/constants.ts";
import { Format, FormatExtras } from "../../../config/types.ts";
import { Metadata } from "../../../config/types.ts";
import { mergeConfigs } from "../../../core/config.ts";
import PngImage from "../../../core/png.ts";
import { ProjectContext } from "../../types.ts";
import {
  kCardStyle,
  kCreator,
  kImage,
  kImageHeight,
  kImageWidth,
  kLocale,
  kOpenGraph,
  kSite,
  kSiteName,
  kSiteUrl,
  kTwitterCard,
} from "./website-config.ts";

const kCard = "card";

interface SocialMetadataProvider {
  key: string;
  prefix: string;
  metadata: Metadata;
  filter?: (key: string) => string;
  resolveDefaults?: (finalMetadata: Metadata) => void;
}

export function metadataHtmlPostProcessor(
  source: string,
  project: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  return (doc: Document): Promise<string[]> => {
    // read document level metadata
    const pageMeta = pageMetadata(format, extras);

    // The open graph provider
    const openGraphMetadataProvider: SocialMetadataProvider = {
      key: kOpenGraph,
      prefix: "og",
      metadata: {
        ...pageMeta,
        ...opengraphMetadata(format),
      },
      filter: (key: string) => {
        // copy image-height to image:height
        if ([kImageHeight, kImageWidth].includes(key)) {
          return key.replace("-", ":");
        }
        return key;
      },
    };

    // The twitter card provider
    const twitterMetadataProvider: SocialMetadataProvider = {
      key: kTwitterCard,
      prefix: "twitter",
      metadata: {
        ...pageMeta,
        ...twitterMetadata(format),
      },
      filter: (key: string) => {
        // copy card-style to card
        if (key === kCardStyle) {
          return kCard;
        }
        return key;
      },
      resolveDefaults: (finalMetadata: Metadata) => {
        if (finalMetadata[kCardStyle] === undefined) {
          finalMetadata[kCardStyle] = finalMetadata[kImage]
            ? "summary_large_image"
            : "summary";
        }
      },
    };

    // go through each metadata provider and emit metadata
    [
      openGraphMetadataProvider,
      twitterMetadataProvider,
    ].forEach((provider) => {
      // alias metadata
      const metadata = provider.metadata;

      // If not explicitly enabled, skip this provider
      const siteMeta = format.metadata[kSite] as Metadata;
      if (
        !format.metadata[provider.key] && (!siteMeta || !siteMeta[provider.key])
      ) {
        return;
      }
      // If there is no title, skip this provider
      if (metadata[kTitle] === undefined) {
        return;
      }

      // find a preview image if one is not provided
      if (metadata[kImage] === undefined) {
        metadata[kImage] = findPreviewImg(doc);

        // if we still haven't found a preview, use the site image
        if (metadata[kImage] === undefined) {
          const siteMeta = format.metadata[kSite] as Metadata;
          metadata[kImage] = siteMeta[kImage];
        }
      }

      // Convert image to absolute href and add height and width
      resolveImageMetadata(source, project, format, metadata);

      // Allow the provider to resolve any defaults
      if (provider.resolveDefaults) {
        provider.resolveDefaults(metadata);
      }

      // Append the metadata
      Object.keys(metadata).forEach((key) => {
        if (metadata[key] !== undefined) {
          const data = metadata[key] as string;
          if (provider.filter) {
            key = provider.filter(key);
          }
          writeMeta(`${provider.prefix}:${key}`, data, doc);
        }
      });
    });

    return Promise.resolve([]);
  };
}

function opengraphMetadata(
  format: Format,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  // populate defaults
  const openGraph = mergedSiteAndDocumentData(kOpenGraph, format);

  // Check the site for title
  const siteMeta = format.metadata[kSite] as Metadata;
  if (siteMeta && siteMeta[kTitle]) {
    metadata[kSiteName] = siteMeta[kTitle];
  }

  // Read open graph data in
  if (openGraph && typeof (openGraph) === "object") {
    [kTitle, kDescription, kImage, kLocale, kSiteName].forEach((key) => {
      if (openGraph[key] !== undefined) {
        metadata[key] = openGraph[key];
      }
    });
  }
  return metadata;
}

function twitterMetadata(format: Format) {
  const metadata: Record<string, unknown> = {};

  // populate defaults
  const twitterData = mergedSiteAndDocumentData(kTwitterCard, format);
  if (twitterData && typeof (twitterData) === "object") {
    [kTitle, kDescription, kImage, kCreator, kSite, kCardStyle].forEach(
      (key) => {
        if (twitterData[key] !== undefined) {
          metadata[key] = twitterData[key];
        }
      },
    );
  }
  return metadata;
}

function pageMetadata(
  format: Format,
  extras: FormatExtras,
): Record<string, unknown> {
  const pageTitle = previewTitle(format, extras) as string;
  const pageDescription = format.metadata[kDescription] as string;
  const pageImage = format.metadata[kImage] as string;

  return {
    [kTitle]: pageTitle,
    [kDescription]: pageDescription || format.metadata[kSubtitle],
    [kImage]: pageImage,
  };
}

function resolveImageMetadata(
  source: string,
  project: ProjectContext,
  format: Format,
  metadata: Metadata,
) {
  // populate defaults
  const siteMeta = format.metadata[kSite] as Metadata;
  if (metadata[kImage] && siteMeta && siteMeta[kSiteUrl] !== undefined) {
    // Resolve any relative urls and figure out image size
    const imgMeta = imageMetadata(
      metadata[kImage] as string,
      siteMeta[kSiteUrl] as string,
      source,
      project,
    );

    // Update the image information
    metadata[kImage] = imgMeta.href;
    metadata[kImageHeight] = imgMeta.height;
    metadata[kImageWidth] = imgMeta.width;
  }
}

function mergedSiteAndDocumentData(
  key: string,
  format: Format,
): boolean | Metadata {
  const siteData = format.metadata[kSite] as Metadata;

  const siteMetadata = siteData && siteData[key] !== undefined
    ? siteData[key]
    : false;
  const docMetadata = format.metadata[key] !== undefined
    ? format.metadata[key]
    : false;

  if (
    typeof (siteMetadata) === "object" &&
    typeof (docMetadata) === "object"
  ) {
    return mergeConfigs(
      siteMetadata,
      docMetadata,
    ) as Metadata;
  } else if (docMetadata !== false) {
    return docMetadata as boolean | Metadata;
  } else if (siteMetadata !== false) {
    return siteMetadata as boolean | Metadata;
  } else {
    // All the metadata are false or undefined, return false
    return false;
  }
}

function previewTitle(format: Format, extras: FormatExtras) {
  const meta = extras.metadata || {};
  if (meta[kPageTitle] !== undefined) {
    return meta[kPageTitle];
  } else if (extras.pandoc?.[kTitlePrefix] !== undefined) {
    // If the title prefix is the same as the title, don't include it as a prefix
    if (extras.pandoc?.[kTitlePrefix] === format.metadata[kTitle]) {
      return format.metadata[kTitle];
    } else if (format.metadata[kTitle]) {
      return extras.pandoc?.[kTitlePrefix] + " - " + format.metadata[kTitle];
    } else {
      return undefined;
    }
  } else {
    return format.metadata[kTitle];
  }
}

function imageMetadata(
  image: string,
  baseUrl: string,
  source: string,
  context: ProjectContext,
) {
  if (image.match(/^(?:http|https)\:\/\/.+/)) {
    // We can't resolve any size data, just return the image
    return {
      href: image,
    };
  } else if (image.startsWith("/")) {
    // This is a project relative path
    const imagePath = join(context.dir, image.slice(1));
    const size = imageSize(imagePath);

    // read the image size
    return {
      href: `${baseUrl}${image}`,
      height: size?.height,
      width: size?.width,
    };
  } else {
    // This is an input relative path
    const sourceRelative = relative(context.dir, source);
    const imageProjectRelative = join(
      dirname(sourceRelative),
      image,
    );
    const imagePath = join(context.dir, imageProjectRelative);
    const size = imageSize(imagePath);

    // resolve the image path into an absolute href
    return {
      href: `${baseUrl}/${imageProjectRelative}`,
      height: size?.height,
      width: size?.width,
    };
  }
}

function imageSize(path: string) {
  if (path !== undefined) {
    if (path.endsWith(".png")) {
      if (existsSync(path)) {
        const imageData = Deno.readFileSync(path);
        const png = new PngImage(imageData);
        return {
          height: png.height,
          width: png.width,
        };
      }
    }
  }
}

function writeMeta(name: string, content: string, doc: Document) {
  // Meta tag
  const m = doc.createElement("META");
  m.setAttribute("name", name);
  m.setAttribute("content", content);

  // New Line
  const nl = doc.createTextNode("\n");

  // Insert the nodes
  doc.querySelector("head")?.appendChild(m);
  doc.querySelector("head")?.appendChild(nl);
}

const kNamedFileRegex =
  /(.*?(?:preview|feature|cover|thumbnail).*?(?:\.png|\.gif|\.jpg|\.jpeg|\.webp))/;
function findPreviewImg(
  doc: Document,
): string | undefined {
  let image = undefined;
  // look for an image explicitly marked as the preview image (.class .quarto-preview)
  const match = doc.querySelector("img.preview-image");
  if (match) {
    const src = match.getAttribute("src");
    if (src !== null) {
      image = src;
    }
  }

  // look for an image with name feature, cover, or thumbnail
  if (image == undefined) {
    const imgs = doc.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i] as Element;
      const src = img.getAttribute("src");
      if (src !== null && kNamedFileRegex.test(src)) {
        image = src;
        break;
      }
    }
  }

  return image;
}
