/*
* website-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/exists.ts";
import { dirname, join, relative } from "path/mod.ts";
import {
  kDescription,
  kPageTitle,
  kTitle,
  kTitlePrefix,
} from "../../../config/constants.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { Metadata } from "../../../config/metadata.ts";
import { mergeConfigs } from "../../../core/config.ts";
import PngImage from "../../../core/png.ts";
import { ProjectContext } from "../../project-context.ts";
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
  OpenGraphConfig,
  TwitterCardConfig,
} from "./website-config.ts";

const kCard = "card";

export function resolveOpenGraphMetadata(
  source: string,
  project: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  const openGraph = mergedSiteAndDocumentData(kOpenGraph, format);
  if (openGraph) {
    const ogMeta: Record<string, string | undefined> = {};
    // process explicitly set values
    if (openGraph && typeof (openGraph) === "object") {
      const ogData = openGraph as OpenGraphConfig;
      ogMeta[kTitle] = ogData[kTitle] as string;
      ogMeta[kDescription] = ogData[kDescription] as string;
      ogMeta[kImage] = ogData[kImage] as string;
      ogMeta[kImageHeight] = ogData[kImageHeight] !== undefined
        ? String(ogData[kImageHeight])
        : undefined;
      ogMeta[kImageWidth] = ogData[kImageWidth] !== undefined
        ? String(ogData[kImageWidth])
        : undefined;
      ogMeta[kLocale] = ogData[kLocale] as string;
      ogMeta[kSiteName] = ogData[kSiteName] as string ||
        (format.metadata[kSite] as Metadata)?.[kTitle] as string;
    }

    // Write defaults if the user provided none
    resolveDocumentData(format, extras, ogMeta);
    resolvePreviewImage(source, format, project, ogMeta);

    // Generate the opengraph meta
    const metadata: Record<string, string> = {};
    Object.keys(ogMeta).forEach((key) => {
      if (ogMeta[key] !== undefined) {
        const data = ogMeta[key] as string;
        if ([kImageWidth, kImageHeight].includes(key)) {
          key = key.replace("-", ":");
        }
        metadata[`og:${key}`] = data;
      }
    });
    return metadata;
  }
}

export function resolveTwitterMetadata(
  source: string,
  context: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  // Twitter card
  const twitter = mergedSiteAndDocumentData(kTwitterCard, format);
  if (twitter) {
    const twitterMeta: Record<string, string | undefined> = {};
    if (twitter) {
      // Process explicitly set values
      if (twitter && typeof (twitter) === "object") {
        const twData = twitter as TwitterCardConfig;
        twitterMeta[kTitle] = twData[kTitle] as string;
        twitterMeta[kDescription] = twData[kDescription] as string;
        twitterMeta[kCreator] = twData[kCreator] as string;
        twitterMeta[kSite] = twData[kSite] as string;
        twitterMeta[kImage] = twData[kImage] as string;
        twitterMeta[kImageHeight] = twData[kImageHeight] !== undefined
          ? String(twData[kImageHeight])
          : undefined;
        twitterMeta[kImageWidth] = twData[kImageWidth] !== undefined
          ? String(twData[kImageWidth])
          : undefined;
        twitterMeta[kCard] = twData[kCardStyle] as string;
      }

      // Write defaults if the user provided none
      resolveDocumentData(format, extras, twitterMeta);

      // Image
      resolvePreviewImage(source, format, context, twitterMeta);

      // Automatically choose the best format based upon whether
      // we have a preview image
      twitterMeta[kCard] =
        twitterMeta[kCardStyle] || twitterMeta[kImage] !== undefined
          ? "summary_large_image"
          : "summary";

      // trim contents if needed
      // See https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup
      const limits = [{
        key: kTitle,
        limit: 70,
      }, {
        key: kDescription,
        limit: 200,
      }];
      limits.forEach((limit) => {
        if (twitterMeta[limit.key] !== undefined) {
          twitterMeta[limit.key] = twitterMeta[limit.key]!.length > limit.limit
            ? twitterMeta[limit.key]?.substr(0, limit.limit)
            : twitterMeta[limit.key];
        }
      });
    }

    // Generate the twitter meta
    const metadata: Record<string, string> = {};
    Object.keys(twitterMeta).forEach((key) => {
      if (twitterMeta[key] !== undefined) {
        metadata[`twitter:${key}`] = twitterMeta[key] as string;
      }
    });
    return metadata;
  }
}

function mergedSiteAndDocumentData(
  key: string,
  format: Format,
): boolean | Metadata {
  const siteData = format.metadata[kSite] as Metadata;

  const siteMetadata = siteData[key] !== undefined ? siteData[key] : false;
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
  } else if (meta[kTitlePrefix] !== undefined) {
    // If the title prefix is the same as the title, don't include it as a prefix
    if (meta[kTitlePrefix] === format.metadata[kTitle]) {
      return format.metadata[kTitle];
    } else {
      return meta[kTitlePrefix] + " - " + format.metadata[kTitle];
    }
  } else {
    return format.metadata[kTitle];
  }
}

function resolvePreviewImage(
  source: string,
  format: Format,
  context: ProjectContext,
  metadata: Metadata,
) {
  // First check if this is explicitly provided for the document
  const siteMeta = format.metadata[kSite] as Metadata;
  metadata[kImage] = metadata[kImage] || format.metadata[kImage] ||
    siteMeta[kImage] || findPreviewImage(source, format);

  if (metadata[kImage] && siteMeta && siteMeta[kSiteUrl] !== undefined) {
    // Resolve any relative urls and figure out image size
    const imgMeta = imageMetadata(
      metadata[kImage] as string,
      siteMeta[kSiteUrl] as string,
      source,
      context,
    );

    metadata[kImage] = imgMeta.href;
    metadata[kImageHeight] = imgMeta.height;
    metadata[kImageWidth] = imgMeta.width;
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

function resolveDocumentData(
  format: Format,
  extras: FormatExtras,
  metadata: Metadata,
) {
  metadata[kTitle] = metadata[kTitle] ||
    previewTitle(format, extras) as string;
  metadata[kDescription] = metadata[kDescription] ||
    format.metadata.description as string;
}

const kExplicitPreviewRegex =
  /!\[.*\]\((.*?(?:\.png|\.gif|\.jpg|\.jpeg|\.webp))\)\{.*\.preview-image.*\}/;
const kNamedImageRegex =
  /!\[.*\]\((.*?(?:preview|feature|cover|thumbnail).*?(?:\.png|\.gif|\.jpg|\.jpeg|\.webp))\)\{.*\}/;
function findPreviewImage(
  source: string,
  _format: Format,
): string | undefined {
  const sourceMarkdown = Deno.readTextFileSync(source);

  let image = undefined;
  // look for an image explicitly marked as the preview image (.class .quarto-preview)
  const match = sourceMarkdown.match(kExplicitPreviewRegex);
  if (match) {
    image = match[1];
  }

  // look for an image with name feature, cover, or thumbnail
  if (image == undefined) {
    const namedMatch = sourceMarkdown.match(kNamedImageRegex);
    if (namedMatch) {
      image = namedMatch[1];
    }
  }

  return image;
}
