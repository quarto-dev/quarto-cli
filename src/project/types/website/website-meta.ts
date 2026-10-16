/*
 * website-meta.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Document, Element } from "../../../core/deno-dom.ts";
import { dirname, join, relative } from "../../../deno_ral/path.ts";
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
import {
  computePageTitle,
  projectRelativeHref,
  resolveProjectImage,
} from "./website-shared.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
} from "../../../core/markdown-pipeline.ts";
import { findDescription, findPreviewImg } from "./util/discover-meta.ts";
import { isAbsoluteRef } from "../../../core/http.ts";
import { isDataUrl } from "../../../core/data-url.ts";
import { warnOnce } from "../../../core/log.ts";
import { HtmlPostProcessResult } from "../../../command/render/types.ts";
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

    const warnDataUrlImage = () =>
      warnOnce(
        `Ignoring data URI image for social metadata of ${
          relative(project.dir, source)
        }, as it can't be fetched by URL. Use an image file instead.`,
      );

    // go through each metadata provider and emit metadata
    [
      openGraphMetadataProvider,
      twitterMetadataProvider,
    ].forEach((provider) => {
      // alias metadata
      const metadata = provider.metadata;

      // If disabled by the page or not explicitly enabled, skip this provider
      const siteMeta = format.metadata[kWebsite] as Metadata;
      if (
        format.metadata[provider.key] === false ||
        (!format.metadata[provider.key] &&
          (!siteMeta || !siteMeta[provider.key]))
      ) {
        return;
      }
      // If there is no title, skip this provider
      if (metadata[kTitle] === undefined) {
        return;
      }

      // Crawlers fetch the image by URL, so a data URI can't be used
      if (
        typeof metadata[kImage] === "string" && isDataUrl(metadata[kImage])
      ) {
        warnDataUrlImage();
        metadata[kImage] = undefined;
        metadata[kImageHeight] = undefined;
        metadata[kImageWidth] = undefined;
      }

      // find a preview image if one is not provided
      if (metadata[kImage] === undefined && format.metadata[kImage] !== false) {
        const pagePreviewImg = findPreviewImg(doc);
        let previewImg = pagePreviewImg;
        if (!previewImg) {
          // The site image is written in _quarto.yml, so it is project relative
          let siteImg = websiteImage(project.config);
          if (siteImg && isDataUrl(siteImg.src)) {
            warnDataUrlImage();
            siteImg = undefined;
          }
          previewImg = siteImg && siteMeta?.[kSiteUrl] !== undefined
            ? { ...siteImg, src: projectRelativeHref(siteImg.src, ".") }
            : siteImg;
        }
        metadata[kImage] = previewImg ? previewImg.src : undefined;
        metadata[kImageAlt] = previewImg ? previewImg.alt : undefined;
        if (pagePreviewImg && provider.key === kOpenGraph) {
          usePageDeclaredImageSize(format, metadata);
        }
      }

      // cook up a description if one is not provided
      if (metadata[kDescription] === undefined) {
        metadata[kDescription] = findDescription(doc);
      }

      // Convert image to absolute href and add height and width
      const imagePath = resolveImageMetadata(
        source,
        project,
        format,
        metadata,
        provider.key === kOpenGraph,
      );
      if (imagePath) {
        if (imagePath.startsWith("/")) {
          // This is a project relative path
          const absPath = join(project.dir, imagePath);
          resources.push(relative(dirname(source), absPath));
        } else {
          // This is an input relative path
          resources.push(imagePath);
        }
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
  if (openGraph && typeof openGraph === "object") {
    [
      kTitle,
      kDescription,
      kImage,
      kImageAlt,
      kImageHeight,
      kImageWidth,
      kLocale,
      kSiteName,
    ].forEach((key) => {
      if (openGraph[key] !== undefined) {
        metadata[key] = openGraph[key];
      }
    });

    // Same predicate as mergedSiteAndDocumentData uses to replace the site image
    const docOpenGraph = format.metadata[kOpenGraph];
    const pageSetsImage = !!format.metadata[kImage] ||
      (typeof docOpenGraph === "object" && docOpenGraph !== null &&
        !!(docOpenGraph as Metadata)[kImage]);
    if (pageSetsImage) {
      usePageDeclaredImageSize(format, metadata);
    }
  }
  return metadata;
}

// A size declared on the site describes the site image, so an image the page
// supplies only gets the dimensions the page itself declares
function usePageDeclaredImageSize(format: Format, metadata: Metadata) {
  const docOpenGraph = format.metadata[kOpenGraph];
  const docData = typeof docOpenGraph === "object" && docOpenGraph !== null
    ? docOpenGraph as Metadata
    : {};
  metadata[kImageHeight] = docData[kImageHeight];
  metadata[kImageWidth] = docData[kImageWidth];
}

function twitterMetadata(format: Format) {
  const metadata: Record<string, unknown> = {};

  // populate defaults
  const twitterData = mergedSiteAndDocumentData(kTwitterCard, format);
  if (twitterData && typeof twitterData === "object") {
    [
      kTitle,
      kDescription,
      kImage,
      kImageAlt,
      kCreator,
      kTwitterSite,
      kCardStyle,
    ].forEach(
      (key) => {
        if (twitterData[key] !== undefined) {
          metadata[key] = twitterData[key];
        }
      },
    );
    if (
      twitterData[kImageWidth] !== undefined ||
      twitterData[kImageHeight] !== undefined
    ) {
      warnOnce(
        "The `twitter-card` options `image-width` and `image-height` are ignored, as Twitter Cards have no image size tags. Set them under `open-graph` instead.",
      );
    }
  }
  return metadata;
}

function pageMetadata(
  format: Format,
  extras: FormatExtras,
): Record<string, unknown> {
  const pageTitle = computePageTitle(format, extras) as string;
  const pageDescription = format.metadata[kDescription] as string;
  const pageImage = format.metadata[kImage]
    ? format.metadata[kImage] as string
    : undefined;

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
  includeSize: boolean,
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

    // Update the image information, preferring the size read from the file
    // over a declared one. Twitter Cards have no image size tags, so only
    // providers that emit a size get one.
    metadata[kImage] = imgMeta.href;
    if (includeSize) {
      metadata[kImageHeight] = imgMeta.height ?? metadata[kImageHeight];
      metadata[kImageWidth] = imgMeta.width ?? metadata[kImageWidth];
    }

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

  // Work on a copy: the site metadata is shared by every page
  let siteObject: Metadata | undefined;
  if (typeof siteMetadata === "object") {
    siteObject = { ...(siteMetadata as Metadata) };
    if (format.metadata[kImage]) {
      siteObject[kImage] = format.metadata[kImage];
    } else if (
      typeof siteObject[kImage] === "string" &&
      siteData[kSiteUrl] !== undefined
    ) {
      // The site image is written in _quarto.yml, so it is project relative
      siteObject[kImage] = projectRelativeHref(
        siteObject[kImage] as string,
        ".",
      );
    }
  }
  if (siteObject && typeof docMetadata === "object") {
    return mergeConfigs(
      siteObject,
      docMetadata,
    ) as Metadata;
  } else if (docMetadata !== false) {
    return docMetadata as boolean | Metadata;
  } else if (siteObject) {
    return siteObject;
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
  }
  // Image paths are relative to the source document unless they start with `/`
  const { href, height, width } = resolveProjectImage(
    image,
    context.dir,
    dirname(relative(context.dir, source)),
  );
  return {
    href: joinUrl(baseUrl, href),
    height,
    width,
  };
}

type metaVal = [string, string];

const kMetaTitleId = "quarto-metatitle";
const kTwitterTitle = "quarto-twittercardtitle";
const kTwitterDesc = "quarto-twittercarddesc";
const kOgTitle = "quarto-ogcardtitle";
const kOgDesc = "quarto-ogcardddesc";
const kMetaSideNameId = "quarto-metasitename";
const kMetaSiteDescId = "quarto-metasitedesc";

function metaMarkdownPipeline(format: Format, extras: FormatExtras) {
  const resolvedTitle = computePageTitle(format);

  const titleMetaHandler = {
    getUnrendered() {
      const inlines: Record<string, string> = {};

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
        if (el && el.innerText === resolvedTitle) {
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
        // Write resolved title back into format.metadata so it flows
        // through to ProjectOutputFile.format for post-render consumers
        const siteMeta = format.metadata[kWebsite] as Metadata;
        if (siteMeta) {
          siteMeta[kTitle] = renderedEl.innerText;
        }
        // Update the og:site_name meta tag
        const el = doc.querySelector(
          `meta[property="og:site_name"]`,
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

  const siteDescriptionHandler = {
    getUnrendered() {
      const siteMeta = format.metadata[kWebsite] as Metadata;
      if (siteMeta && siteMeta[kDescription]) {
        return {
          inlines: { [kMetaSiteDescId]: siteMeta[kDescription] as string },
        };
      }
    },
    processRendered(rendered: Record<string, Element>) {
      const renderedEl = rendered[kMetaSiteDescId];
      if (renderedEl) {
        // Write resolved description back into format.metadata so it flows
        // through to ProjectOutputFile.format for post-render consumers
        const siteMeta = format.metadata[kWebsite] as Metadata;
        if (siteMeta) {
          siteMeta[kDescription] = renderedEl.innerText;
        }
      }
    },
  };

  return createMarkdownPipeline("quarto-meta-markdown", [
    titleMetaHandler,
    siteTitleMetaHandler,
    descriptionMetaHandler,
    siteDescriptionHandler,
  ]);
}
