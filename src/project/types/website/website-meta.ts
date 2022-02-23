/*
* website-meta.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "../../../core/deno-dom.ts";
import { dirname, join, relative } from "path/mod.ts";
import {
  kAuthor,
  kBibliography,
  kDate,
  kDescription,
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
  kGoogleScholar,
  kImage,
  kImageHeight,
  kImageWidth,
  kLocale,
  kOpenGraph,
  kSiteName,
  kSiteUrl,
  kTwitterCard,
  kWebsite,
} from "./website-config.ts";
import { computePageTitle } from "./website-shared.ts";
import {
  createMarkdownPipeline,
  MarkdownPipeline,
} from "./website-pipeline-md.ts";
import { findPreviewImg } from "./util/discover-meta.ts";
import { isAbsoluteRef } from "../../../core/http.ts";
import {
  HtmlPostProcessResult,
  kHtmlEmptyPostProcessResult,
} from "../../../command/render/types.ts";
import { imageSize } from "../../../core/image.ts";
import { resolveInputTarget } from "../../project-index.ts";
import { parseAuthor } from "../../../core/author.ts";
import { encodeAttributeValue } from "../../../core/html.ts";
import { pandocBinaryPath } from "../../../core/resources.ts";
import { execProcess } from "../../../core/process.ts";
import { CSL, cslDateToEDTFDate } from "../../../core/csl.ts";

const kCard = "card";

interface SocialMetadataProvider {
  key: string;
  prefix: string;
  metadata: Metadata;
  filter?: (key: string) => string;
  resolveDefaults?: (finalMetadata: Metadata) => void;
}

export function metadataHtmlDependencies(
  source: string,
  project: ProjectContext,
  format: Format,
  extras: FormatExtras,
) {
  const pipeline = metaMarkdownPipeline(format);
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
  return async (doc: Document): Promise<HtmlPostProcessResult> => {
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
        metadata[kImage] = findPreviewImg(doc);

        // if we still haven't found a preview, use the site image
        if (metadata[kImage] === undefined) {
          const siteMeta = format.metadata[kWebsite] as Metadata;
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

    const googleScholarEnabled = () => {
      const siteMeta = format.metadata[kWebsite] as Metadata;
      // Disabled by the format / document
      if (format.metadata[kGoogleScholar] === false) {
        return false;
      }

      // Disabled for the site
      if (siteMeta && siteMeta[kGoogleScholar] === false) {
        return false;
      }

      return true;
    };

    // read google scholar metadata
    if (googleScholarEnabled()) {
      const citationMeta = await googleScholarMeta(
        source,
        project,
        pageMeta[kTitle] as string,
        format,
        extras,
      );
      if (citationMeta) {
        citationMeta.forEach((meta) => {
          writeMeta(meta[0], meta[1], doc);
        });
      }
    }

    // Process any pipelined markdown
    pipeline.processRenderedMarkdown(doc);

    return Promise.resolve(kHtmlEmptyPostProcessResult);
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
    [kTitle, kDescription, kImage, kCreator, kWebsite, kCardStyle].forEach(
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
  const siteMeta = format.metadata[kWebsite] as Metadata;
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
  const siteData = format.metadata[kWebsite] as Metadata;

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

const kCitationUrl = "citation-url";
const kPublicationDate = "publication-date";
const kPublicationType = "publication-type";
const kPublicationTitle = "publication-title";
const kPublicationVolume = "publication-volume";
const kPublicationIssue = "publication-issue";
const kPublicationISSN = "publiction-issn";
const kPublicationISBN = "publication-isbn";
const kPublicationFirstPage = "publication-firstpage";
const kPublicationLastPage = "publication-lastpage";
const kPublicationInstitution = "publication-institution";
const kPublicationReportNumber = "publication-report-number";

type metaVal = [string, string];

async function googleScholarMeta(
  source: string,
  project: ProjectContext,
  title: string,
  format: Format,
  _extras: FormatExtras,
): Promise<metaVal[] | undefined> {
  if (format) {
    // The scholar metadata that we'll generate into
    const scholarMeta: metaVal[] = [];
    scholarMeta.push(["citation_title", title]);
    const write = metadataWriter(scholarMeta);
    const parse = metadataParse(format, scholarMeta);

    // Process Authors
    const authors = parseAuthor(format.metadata[kAuthor]);
    if (authors) {
      authors.forEach((author) => {
        if (author) {
          write("citation_author", author.name);
        }
      });
    }

    // Process Date
    parse(kDate, "citation_online_date");

    // Process the publication data
    const publicationInstitution = format.metadata[kPublicationInstitution];
    const type = format.metadata[kPublicationType];
    if (type === "journal") {
      parse(kPublicationTitle, "citation_journal_title");
    } else if (type === "conference") {
      parse(kPublicationTitle, "citation_conference_title");
    } else if (type === "dissertation" || type === "thesis") {
      write(
        "citation_dissertation_institution",
        publicationInstitution,
      );
    } else if (type === "technical-report") {
      write(
        "citation_technical_report_institution",
        publicationInstitution,
      );
      write(
        "citation_technical_report_number",
        kPublicationReportNumber,
      );
    } else {
      parse(kPublicationTitle, "citation_journal_title");
    }
    parse([kPublicationDate, kDate], "citation_publication_date");
    parse(kPublicationISBN, "citation_isbn");
    parse(kPublicationISSN, "citation_issn");
    parse(kPublicationVolume, "citation_volume");
    parse(kPublicationIssue, "citation_issue");
    parse(kPublicationFirstPage, "citation_firstpage");
    parse(kPublicationLastPage, "citation_lastpage");

    // Process the url
    if (format.metadata[kCitationUrl]) {
      write(
        "citation_fulltext_html_url",
        format.metadata[kCitationUrl],
      );
    } else {
      const siteMeta = format.metadata[kWebsite] as Metadata;
      if (siteMeta && siteMeta[kSiteUrl]) {
        // Try to compute url
        const relativePath = relative(project.dir, source);
        const inputTarget = await resolveInputTarget(
          project,
          relativePath,
          false,
        );
        const fullTextUrl = `${siteMeta[kSiteUrl]}/${inputTarget?.outputHref}`;
        write(
          "citation_fulltext_html_url",
          fullTextUrl,
        );
      }
    }

    // Generate the references by reading the bibliography and parsing the html
    const bibliography = format.metadata[kBibliography] as string[];
    if (bibliography) {
      const references = await toCSLJSON(dirname(source), bibliography);
      references.forEach((ref) => {
        const refMetas = toScholarMetadata(ref);
        const metaStrs = refMetas.map((refMeta) => {
          return `${refMeta[0]}=${refMeta[1]};`;
        });
        write("citation_reference", metaStrs.join());
      });
    }

    return scholarMeta;
  } else {
    return undefined;
  }
}

function metadataWriter(metadata: metaVal[]) {
  const write = (key: string, value: unknown) => {
    metadata.push([key, encodeAttributeValue(value as string)]);
  };
  return write;
}

function metadataParse(format: Format, metadata: metaVal[]) {
  const writer = metadataWriter(metadata);
  const parse = (key: string | string[], metaKey: string) => {
    const keys = Array.isArray(key) ? key : [key];
    for (const key of keys) {
      const val = format.metadata[key];
      if (val) {
        writer(metaKey, val);
        break;
      }
    }
  };
  return parse;
}

function writeMeta(name: string, content: string, doc: Document) {
  // Meta tag
  const m = doc.createElement("META");
  if (name.startsWith("og:")) {
    m.setAttribute("property", name);
  } else {
    m.setAttribute("name", name);
  }
  m.setAttribute("content", content);

  // New Line
  const nl = doc.createTextNode("\n");

  // Insert the nodes
  doc.querySelector("head")?.appendChild(m);
  doc.querySelector("head")?.appendChild(nl);
}

const kMetaTitleId = "quarto-metatitle";
const kMetaSideNameId = "quarto-metasitename";
function metaMarkdownPipeline(format: Format) {
  const titleMetaHandler = {
    getUnrendered() {
      const resolvedTitle = computePageTitle(format);
      if (resolvedTitle !== undefined) {
        return { inlines: { [kMetaTitleId]: resolvedTitle } };
      }
    },
    processRendered(rendered: Record<string, Element>, doc: Document) {
      const renderedEl = rendered[kMetaTitleId];
      if (renderedEl) {
        // Update the document title
        const el = doc.querySelector(
          `head title`,
        );
        if (el) {
          el.innerHTML = renderedEl.innerText;
        }

        ['meta[name="og:title"]', 'meta[name="twitter:title"]'].forEach(
          (sel) => {
            const metaEl = doc.querySelector(sel);
            if (metaEl) {
              metaEl.setAttribute("content", renderedEl.innerText);
            }
          },
        );
      }
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
          `meta[name="og:site-name"]`,
        );
        if (el) {
          el.setAttribute("content", renderedEl.innerText);
        }
      }
    },
  };

  return createMarkdownPipeline("quarto-meta-markdown", [
    titleMetaHandler,
    siteTitleMetaHandler,
  ]);
}

function toScholarMetadata(
  entry: CSL,
): metaVal[] {
  const metadata: metaVal[] = [];
  const write = metadataWriter(metadata);

  if (entry.title) {
    write("citation_title", entry.title);
  }

  entry.author?.forEach((author) => {
    write(
      "citation_author",
      author.literal || `${author.given} ${author.given}`,
    );
  });
  if (entry.issued) {
    write("citation_publication_date", cslDateToEDTFDate(entry.issued));
  }
  if (entry.ISBN) {
    write("citation_isbn", entry.ISBN);
  }
  if (entry.ISSN) {
    write("citation_issn", entry.ISSN);
  }
  if (entry.volume) {
    write("citation_volume", entry.volume);
  }
  if (entry.issue) {
    write("citation_issue", entry.volume);
  }

  if (entry["container-title"]) {
    switch (entry.type) {
      case ("paper-conference"):
        write("citation_conference_title", entry["container-title"]);
        break;
      case ("report"):
        break;
      default:
        write("citation_journal_title", entry["container-title"]);
        break;
    }
  }

  if (entry.publisher) {
    switch (entry.type) {
      case ("thesis"):
        write("citation_dissertation_institution", entry.publisher);
        break;
      case ("report"):
        write("citation_technical_report_institution", entry.publisher);
        break;
    }
  }
  return metadata;
}

async function toCSLJSON(dir: string, biblios: string[]) {
  const bibloEntries = [];
  for (const biblio of biblios) {
    const cmd = [pandocBinaryPath()];
    cmd.push(join(dir, biblio));
    cmd.push("-t");
    cmd.push("csljson");
    cmd.push("--citeproc");

    const result = await execProcess(
      { cmd, stdout: "piped", stderr: "piped", cwd: dir },
    );
    if (result.success) {
      if (result.stdout) {
        const entries = JSON.parse(result.stdout);
        bibloEntries.push(...entries);
      }
    } else {
      throw new Error(
        `Failed to generate bibliography, rendering failed with code ${result.code}\n${result.stderr}`,
      );
    }
  }
  return bibloEntries;
}
