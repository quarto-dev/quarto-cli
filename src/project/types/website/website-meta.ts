/*
* website-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join, relative } from "path/mod.ts";
import {
  kDescription,
  kPageTitle,
  kTitle,
  kTitlePrefix,
} from "../../../config/constants.ts";
import { Format, FormatExtras } from "../../../config/format.ts";
import { Metadata } from "../../../config/metadata.ts";
import PngImage from "../../../core/png.ts";
import { ProjectContext } from "../../project-context.ts";
import { kSiteUrl } from "./website-config.ts";

export function resolveOpenGraphMetadata(
  _source: string,
  _project: ProjectContext,
  _format: Format,
  _extras: FormatExtras,
) {
  return {} as Record<string, string>;
}

function previewTitle(format: Format, extras: FormatExtras) {
  const meta = extras.metadata || {};
  if (meta[kPageTitle] !== undefined) {
    return meta[kPageTitle];
  } else if (meta[kTitlePrefix] !== undefined) {
    return meta[kTitlePrefix] + " - " + format.metadata[kTitle];
  } else {
    return format.metadata[kTitle];
  }
}

export function resolveTwitterMetadata(
  source: string,
  context: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  const kTwitter = "twitter-card";
  const kCard = "card";
  const kCardStyle = "card-style";
  const kCreator = "creator";
  const kSite = "site";
  const kImage = "image";
  const kImageWidth = "image-width";
  const kImageHeight = "image-height";

  // Twitter card
  if (format.metadata[kTwitter]) {
    const twitter = format.metadata[kTwitter];
    const twitterMeta: Record<string, string | undefined> = {};
    if (twitter) {
      // Process explicitly set values
      if (twitter && typeof (twitter) === "object") {
        const twData = twitter as Record<string, unknown>;
        twitterMeta[kCreator] = twData[kCreator] as string;
        twitterMeta[kSite] = twData[kSite] as string;
        twitterMeta[kImage] = twData[kImage] as string;
        twitterMeta[kCard] = twData[kCardStyle] as string;
      }

      // Write defaults if the user provided none
      twitterMeta[kTitle] = twitterMeta[kTitle] ||
        previewTitle(format, extras) as string;
      twitterMeta[kDescription] = twitterMeta[kDescription] ||
        format.metadata.description as string;

      // Image
      const siteMeta = format.metadata[kSite] as Metadata;
      if (siteMeta && siteMeta[kSiteUrl] !== undefined) {
        // Twitter images need to be full paths, so only do this if we have a
        // site url
        const image = findPreviewImage(source, format);
        if (image) {
          if (image.image.startsWith("/")) {
            // This is a project relative path
            twitterMeta[kImage] = twitterMeta[kImage] ||
              `${siteMeta[kSiteUrl]}${image.image}`;
          } else {
            // This is an input relative path
            const sourceRelative = relative(context.dir, source);
            const imageProjectRelative = join(
              dirname(sourceRelative),
              image.image,
            );
            // resolve the image path into an absolute href
            twitterMeta[kImage] = twitterMeta[kImage] ||
              `${siteMeta[kSiteUrl]}/${imageProjectRelative}`;
          }

          // set the image size
          twitterMeta[kImageHeight] = String(image.height);
          twitterMeta[kImageWidth] = String(image.width);
        }
      }

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

const kExplicitPreviewRegex = /!\[.*\]\((.*)\)\{.*.quarto-preview.*\}/;
const kNamedImageRegex = /!\[.*\]\((.*?(?:feature|cover|thumbnail).*?)\)\{.*\}/;
function findPreviewImage(
  source: string,
  _format: Format,
): { image: string; height?: number; width?: number } | undefined {
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

  if (image !== undefined) {
    if (image.endsWith(".png")) {
      const imageData = Deno.readFileSync(join(dirname(source), image));
      const png = new PngImage(imageData);
      return {
        image,
        height: png.height,
        width: png.width,
      };
    }
    return {
      image,
    };
  }

  // didn't find an image, sorry!
  return image;
}
