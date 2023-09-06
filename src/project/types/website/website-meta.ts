/*
 * website-meta.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../../core/deno-dom.ts";
import { dirname, join, relative } from "path/mod.ts";
import {
  kAbstract,
  kDescription,
  kNumberSections,
  kSubtitle,
  kTitle,
} from "../../../config/constants.ts";
import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
} from "../../../config/types.ts";
import { Metadata } from "../../../config/types.ts";
import { mergeConfigs } from "../../../core/config.ts";
import { ProjectContext } from "../../types.ts";
import {
  kCardStyle,
  kCreator,
  kImage,
  kImageAlt,
  kImageHeight,
  kImageWidth,
  kLocale,
  kOpenGraph,
  kSiteName,
  kSiteUrl,
  kTwitterCard,
  kTwitterSite,
  kWebsite,
} from "./website-constants.ts";
import { computePageTitle } from "./website-shared.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
} from "./website-pipeline-md.ts";
import { findDescription, findPreviewImg } from "./util/discover-meta.ts";
import { isAbsoluteRef } from "../../../core/http.ts";
import { HtmlPostProcessResult } from "../../../command/render/types.ts";
import { imageSize } from "../../../core/image.ts";
import { writeMetaTag } from "../../../format/html/format-html-shared.ts";
import { joinUrl } from "../../../core/url.ts";
import { truncateText } from "../../../core/text.ts";
import { websiteImage } from "./website-config.ts";

const kCard = "card";

interface SocialMetadataProvider {
  key: string;
  prefix: string;
  metadata: Metadata;
  filter?: (key: string) => string;
  resolveValue?: (key: string, value: string) => string;
  resolveDefaults?: (finalMetadata: Metadata) => void;
}

export function metadataHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  const pipeline = metaMarkdownPipeline(format, extras);
  return {
    [kHtmlPostprocessors]: metadataHtmlPostProcessor(
      source,
      project,
      format,
      extras,
      pipeline,
    ),
    [kMarkdownAfterBody]: pipeline.markdownAfterBody(),
  };
}

export function metadataHtmlPostProcessor(
  source: string,
  project: ProjectContext,
  format: Format,
  extras: FormatExtras,
  pipeline: MarkdownPipeline,
) {
  return (doc: Document): Promise<HtmlPostProcessResult> => {
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
        if ([kImageHeight, kImageWidth, kImageAlt].includes(key)) {
          return key.replace("-", ":");
        }
        if (key === kSiteName) {
          return "site_name";
        }
        return key;
      },
      resolveValue: (key: string, value: string) => {
        // Limit to 300 chars for Open Graph
        if ([kDescription].includes(key)) {
          return truncateText(value.trim(), 200, "punctuation");
        }

        return value;
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
        if ([kImageAlt].includes(key)) {
          return key.replace("-", ":");
        }

        return key;
      },
      resolveValue: (key: string, value: string) => {
        // Limit to 200 chars for Twitter
        if ([kDescription].includes(key)) {
          return truncateText(value.trim(), 200, "punctuation");
        }
        return value;
      },
      resolveDefaults: (finalMetadata: Metadata) => {
        if (finalMetadata[kCardStyle] === undefined) {
          finalMetadata[kCardStyle] = finalMetadata[kImage]
            ? "summary_large_image"
            : "summary";
        }
      },
    };

    // Resources that we find during this post processing
    const resources: string[] = [];

    // go through each metadata provider and emit metadata
    [
      openGraphMetadataProvider,
      twitterMetadataProvider,
    ].forEach((provider) => {
      // alias metadata
      const metadata = provider.metadata;

      // If not explicitly enabled, skip this provider
      const siteMeta = format.metadata[kWebsite] as Metadata;
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
        metadata[kImage] = findPreviewImg(doc, true) ||
          websiteImage(project.config);
      }

      // cook up a description if one is not provided
      if (metadata[kDescription] === undefined) {
        metadata[kDescription] = findDescription(doc);
      }

      // Convert image to absolute href and add height and width
      const imagePath = resolveImageMetadata(source, project, format, metadata);
      if (imagePath) {
        resources.push(imagePath);
      }

      // Allow the provider to resolve any defaults
      if (provider.resolveDefaults) {
        provider.resolveDefaults(metadata);
      }

      // Append the metadata
      Object.keys(metadata).forEach((key) => {
        if (metadata[key] !== undefined) {
          // Resolve the value
          const data = metadata[key] as string;
          const value = provider.resolveValue
            ? provider.resolveValue(key, data)
            : data;

          // Filter the key
          if (provider.filter) {
            key = provider.filter(key);
          }

          writeMetaTag(`${provider.prefix}:${key}`, value, doc);
        }
      });
    });

    // Process any pipelined markdown
    pipeline.processRenderedMarkdown(doc);

    return Promise.resolve({
      resources,
      supporting: [],
    });
  };
}

function opengraphMetadata(
  format: Format,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  // populate defaults
  const openGraph = mergedSiteAndDocumentData(kOpenGraph, format);

  // Check the site for title
  const siteMeta = format.metadata[kWebsite] as Metadata;
  if (siteMeta && siteMeta[kTitle]) {
    metadata[kSiteName] = siteMeta[kTitle];
  }

  // Read open graph data in
  if (openGraph && typeof (openGraph) === "object") {
    [
      kTitle,
      kDescription,
      kImage,
      kImageHeight,
      kImageWidth,
      kLocale,
      kSiteName,
    ].forEach((key) => {
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
    [kTitle, kDescription, kImage, kCreator, kTwitterSite, kCardStyle].forEach(
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
  const pageTitle = computePageTitle(format, extras) as string;
  const pageDescription = format.metadata[kDescription] as string;
  const pageImage = format.metadata[kImage] as string;

  return {
    [kTitle]: pageTitle,
    [kDescription]: pageDescription || format.metadata[kAbstract] ||
      format.metadata[kSubtitle],
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
  const siteMeta = format.metadata[kWebsite] as Metadata;
  if (metadata[kImage] && siteMeta && siteMeta[kSiteUrl] !== undefined) {
    // Resolve any relative urls and figure out image size
    const inputRelImg = metadata[kImage];
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

    const altText = format.metadata[kImageAlt];
    if (altText && !metadata[kImageAlt]) {
      metadata[kImageAlt] = altText;
    }

    return inputRelImg as string;
  }
}

function mergedSiteAndDocumentData(
  key: string,
  format: Format,
): boolean | Metadata {
  const siteData = format.metadata[kWebsite] as Metadata;

  const siteMetadata = siteData && siteData[key] !== undefined
    ? siteData[key]
    : false;
  const docMetadata = format.metadata[key] !== undefined
    ? format.metadata[key]
    : false;

  if (typeof (siteMetadata) === "object" && format.metadata[kImage]) {
    const siteMeta = siteMetadata as Metadata;
    siteMeta[kImage] = format.metadata[kImage];
  }
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

function imageMetadata(
  image: string,
  baseUrl: string,
  source: string,
  context: ProjectContext,
) {
  if (isAbsoluteRef(image)) {
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
      path: image,
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
      path: imageProjectRelative,
      href: joinUrl(baseUrl, imageProjectRelative),
      height: size?.height,
      width: size?.width,
    };
  }
}

type metaVal = [string, string];

const kMetaTitleId = "quarto-metatitle";
const kTwitterTitle = "quarto-twittercardtitle";
const kTwitterDesc = "quarto-twittercarddesc";
const kOgTitle = "quarto-ogcardtitle";
const kOgDesc = "quarto-ogcardddesc";
const kMetaSideNameId = "quarto-metasitename";
function metaMarkdownPipeline(format: Format, extras: FormatExtras) {
  const titleMetaHandler = {
    getUnrendered() {
      const inlines: Record<string, string> = {};
      const resolvedTitle = computePageTitle(format);
      if (resolvedTitle !== undefined) {
        inlines[kMetaTitleId] = resolvedTitle;
      }

      const twitterMeta = twitterMetadata(format);
      inlines[kTwitterTitle] = twitterMeta.title as string || resolvedTitle ||
        "";

      const ogMeta = opengraphMetadata(format);
      inlines[kOgTitle] = ogMeta.title as string || resolvedTitle || "";
      return { inlines };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const renderedEl = rendered[kMetaTitleId];
      if (renderedEl) {
        // Update the document title
        const el = doc.querySelector(
          `head title`,
        );
        if (el) {
          if (format.pandoc[kNumberSections] === false) {
            // Remove chapter numbers if not numbered
            const numberEl = renderedEl.querySelector("span.chapter-number");
            if (numberEl) {
              numberEl.remove();
            }
            // Collapse contiguous whitespace
            const collapsed = renderedEl.innerText.replaceAll(/\s+/g, " ");
            el.innerHTML = collapsed;
          } else {
            el.innerHTML = renderedEl.innerText;
          }
        }
      }

      // Process social metadata titles
      [{
        key: kOgTitle,
        sel: 'meta[property="og:title"]',
      }, {
        key: kTwitterTitle,
        sel: 'meta[name="twitter:title"]',
      }].forEach(
        (obj) => {
          const renderedObjEl = rendered[obj.key];
          if (renderedObjEl) {
            const metaEl = doc.querySelector(obj.sel);
            if (metaEl) {
              metaEl.setAttribute("content", renderedObjEl.innerText);
            }
          }
        },
      );
    },
  };

  const siteTitleMetaHandler = {
    getUnrendered() {
      const siteMeta = format.metadata[kWebsite] as Metadata;
      if (siteMeta && siteMeta[kTitle]) {
        return { inlines: { [kMetaSideNameId]: siteMeta[kTitle] as string } };
      }
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const renderedEl = rendered[kMetaSideNameId];
      if (renderedEl) {
        // Update the document title
        const el = doc.querySelector(
          `meta[name="og:site_name"]`,
        );
        if (el) {
          el.setAttribute("content", renderedEl.innerText);
        }
      }
    },
  };

  const descriptionMetaHandler = {
    getUnrendered() {
      const inlines: Record<string, string> = {};

      // read document level metadata
      const pageMeta = pageMetadata(format, extras);
      const siteMeta = format.metadata[kWebsite] as Metadata;
      const pageDesc = pageMeta.description as string | undefined;
      const siteDesc = siteMeta.description as string | undefined;
      const description = pageDesc || siteDesc;
      // Twitter
      const twitterMeta = twitterMetadata(format);
      inlines[kTwitterDesc] = twitterMeta.description as string ||
        description ||
        "";

      // Oopengraph
      const ogMeta = opengraphMetadata(format);
      inlines[kOgDesc] = ogMeta.description as string || description || "";
      return { inlines };
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      // Meta values
      const metaVals = [{
        sel: 'meta[property="og:description"]',
        key: kOgDesc,
      }, { sel: 'meta[name="twitter:description"]', key: kTwitterDesc }];

      metaVals.forEach((metaVal) => {
        const renderedEl = rendered[metaVal.key];
        if (renderedEl) {
          const metaEl = doc.querySelector(metaVal.sel);
          if (metaEl) {
            metaEl.setAttribute("content", renderedEl.innerText);
          }
        }
      });
    },
  };

  return createMarkdownPipeline("quarto-meta-markdown", [
    titleMetaHandler,
    siteTitleMetaHandler,
    descriptionMetaHandler,
  ]);
}
