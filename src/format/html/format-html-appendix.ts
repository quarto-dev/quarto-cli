/*
 * format-html-appendix.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { PandocInputTraits } from "../../command/render/types.ts";
import {
  kAppendixAttributionBibTex,
  kAppendixAttributionCiteAs,
  kLang,
  kPositionedRefs,
  kSectionTitleCitation,
  kSectionTitleCopyright,
  kSectionTitleReuse,
} from "../../config/constants.ts";
import { Format, PandocFlags } from "../../config/types.ts";
import { renderBibTex, renderHtml } from "../../core/bibliography.ts";
import { Document, Element } from "../../core/deno-dom.ts";
import {
  documentCSL,
  getCSLPath,
} from "../../quarto-core/attribution/document.ts";
import {
  createCodeBlock,
  createCodeCopyButton,
  hasMarginCites,
  hasMarginRefs,
  insertFootnotesTitle,
  insertReferencesTitle,
  insertTitle,
  kAppendixCiteAs,
  kAppendixStyle,
  kCitation,
  kCopyright,
  kLicense,
} from "./format-html-shared.ts";

const kAppendixCreativeCommonsLic = [
  "CC BY",
  "CC BY-SA",
  "CC BY-ND",
  "CC BY-NC",
];

const kStylePlain = "plain";
const kStyleDefault = "default";

const kAppendixHeadingClass = "quarto-appendix-heading";
const kAppendixContentsClass = "quarto-appendix-contents";
const kQuartoSecondaryLabelClass = "quarto-appendix-secondary-label";
const kQuartoCiteAsClass = "quarto-appendix-citeas";
const kQuartoCiteBibtexClass = "quarto-appendix-bibtex";
const kAppendixId = "quarto-appendix";

export async function processDocumentAppendix(
  input: string,
  inputTraits: PandocInputTraits,
  format: Format,
  flags: PandocFlags,
  doc: Document,
  offset?: string,
) {
  // Don't do anything at all if the appendix-style is false or 'none'
  if (
    format.metadata.book || // It never makes sense to process the appendix when we're in a book
    format.metadata[kAppendixStyle] === false ||
    format.metadata[kAppendixStyle] === "none"
  ) {
    return;
  }
  const appendixStyle = parseStyle(
    format.metadata[kAppendixStyle] as string,
  );

  // The main content region
  let mainEl = doc.querySelector("main.content");
  if (mainEl === null) {
    // The content region
    mainEl = doc.querySelector("#quarto-content");
  }
  if (mainEl === null) {
    mainEl = doc.querySelector(".page-layout-custom");
  }

  if (mainEl) {
    const appendixEl = doc.createElement("DIV");
    appendixEl.setAttribute("id", kAppendixId);
    if (appendixStyle !== kStylePlain) {
      appendixEl.classList.add(appendixStyle);
    }

    const headingClasses = ["anchored", kAppendixHeadingClass];

    // Gather the sections that should be included
    // in the Appendix
    const appendixSections: Element[] = [];
    const addSection = (fn: (sectionEl: Element) => void, title?: string) => {
      const containerEl = doc.createElement("SECTION");
      containerEl.classList.add(
        kAppendixContentsClass,
      );
      fn(containerEl);

      if (title) {
        insertTitle(
          doc,
          containerEl,
          title,
          2,
          headingClasses,
        );
      }

      appendixSections.push(containerEl);
    };

    // Move the refs into the appendix
    if (!hasMarginCites(format) && !inputTraits[kPositionedRefs]) {
      const refsEl = doc.getElementById("refs");
      if (refsEl) {
        const findRefTitle = (refsEl: Element) => {
          const parentEl = refsEl.parentElement;
          if (
            parentEl && parentEl.tagName === "SECTION" &&
            parentEl.childElementCount === 2 // The section has only the heading + the refs div
          ) {
            const headingEl = parentEl.querySelector("h1, h2, h3, h4, h5, h6");
            if (headingEl) {
              headingEl.remove();
              return headingEl.innerText;
            }
          }
        };
        const existingTitle = findRefTitle(refsEl);
        addSection((sectionEl) => {
          sectionEl.setAttribute("role", "doc-bibliography");
          sectionEl.appendChild(refsEl);

          if (existingTitle) {
            insertTitle(doc, sectionEl, existingTitle, 2, headingClasses);
          } else {
            insertReferencesTitle(
              doc,
              sectionEl,
              format.language,
              2,
              headingClasses,
            );
          }
        });
      }
    }

    // Move the footnotes into the appendix
    if (!hasMarginRefs(format, flags)) {
      const footnoteEls = doc.querySelectorAll('section[role="doc-endnotes"]');
      if (footnoteEls && footnoteEls.length === 1) {
        const footnotesEl = footnoteEls.item(0) as Element;
        insertFootnotesTitle(
          doc,
          footnotesEl,
          format.language,
          2,
          headingClasses,
        );
        appendixSections.push(footnotesEl);
      }
    }

    // Place Re-use, if appropriate
    if (format.metadata[kLicense]) {
      addSection((sectionEl) => {
        const contentsDiv = doc.createElement("DIV");
        contentsDiv.id = "quarto-reuse";
        contentsDiv.classList.add(
          kAppendixContentsClass,
        );

        // Note: We should ultimately replace this with a template
        // based approach that emits the appendix using a partial
        //
        // this will allow us to not include the following code.
        const normalizedLicense = (license: unknown) => {
          if (typeof (license) === "string") {
            const creativeCommons = creativeCommonsLicense(license);
            if (creativeCommons) {
              const licenseUrl = creativeCommonsUrl(
                creativeCommons.base,
                format.metadata[kLang] as string | undefined,
                creativeCommons.version,
              );
              return {
                url: licenseUrl,
                text: licenseUrl,
              };
            } else {
              return { text: license };
            }
          } else {
            const licenseObj = license as Record<string, unknown>;
            return {
              text: licenseObj.text as string,
              url: licenseObj.link,
              type: licenseObj.type,
            };
          }
        };
        const normalizedLicenses = (licenses: unknown) => {
          if (Array.isArray(licenses)) {
            return licenses.map((license) => {
              return normalizedLicense(license);
            });
          } else {
            return [normalizedLicense(licenses)];
          }
        };

        const license = format.metadata[kLicense];
        const normalized = normalizedLicenses(license);
        for (const normalLicense of normalized) {
          const licenseEl = doc.createElement("DIV");
          if (normalLicense.url) {
            const linkEl = doc.createElement("A");
            linkEl.innerText = normalLicense.text;
            linkEl.setAttribute("rel", "license");
            linkEl.setAttribute("href", normalLicense.url);
            licenseEl.appendChild(linkEl);
          } else {
            licenseEl.innerText = normalLicense.text;
          }
          contentsDiv.appendChild(licenseEl);
        }

        sectionEl.appendChild(contentsDiv);
      }, format.language[kSectionTitleReuse] || "Reuse");
    }

    if (format.metadata[kCopyright]) {
      // Note: We should ultimately replace this with a template
      // based approach that emits the appendix using a partial
      //
      // this will allow us to not include the following code.
      const normalizedCopyright = (copyright: unknown) => {
        if (typeof (copyright) === "string") {
          return copyright;
        } else if (copyright) {
          return (copyright as { statement?: string }).statement;
        }
      };
      const copyrightRaw = format.metadata[kCopyright];
      const copyright = normalizedCopyright(copyrightRaw);
      if (copyright) {
        addSection((sectionEl) => {
          const contentsDiv = doc.createElement("DIV");
          contentsDiv.id = "quarto-copyright";
          contentsDiv.classList.add(
            kAppendixContentsClass,
          );

          const licenseEl = doc.createElement("DIV");
          licenseEl.innerText = copyright;
          contentsDiv.appendChild(licenseEl);

          sectionEl.appendChild(contentsDiv);
        }, format.language[kSectionTitleCopyright] || "Copyright");
      }
    }

    // Place the citation for this document itself, if appropriate
    if (format.metadata[kCitation]) {
      // Render the citation data for this document
      const cite = await generateCite(input, format, offset);
      if (cite?.bibtex || cite?.html) {
        addSection((sectionEl) => {
          const contentsDiv = doc.createElement("DIV");
          sectionEl.appendChild(contentsDiv);

          if (cite?.bibtex) {
            // Add the bibtext representation to the appendix
            const bibTexLabelEl = doc.createElement("DIV");
            bibTexLabelEl.classList.add(kQuartoSecondaryLabelClass);
            bibTexLabelEl.innerText =
              format.language[kAppendixAttributionBibTex] ||
              "BibLaTeX citation";
            contentsDiv.appendChild(bibTexLabelEl);

            const bibTexDiv = createCodeBlock(doc, cite.bibtex, "bibtex");
            bibTexDiv.classList.add(kQuartoCiteBibtexClass);
            contentsDiv.appendChild(bibTexDiv);

            const copyButton = createCodeCopyButton(doc, format);
            bibTexDiv.appendChild(copyButton);
          }

          if (cite?.html) {
            // Add the cite as to the appendix
            const citeLabelEl = doc.createElement("DIV");
            citeLabelEl.classList.add(kQuartoSecondaryLabelClass);
            citeLabelEl.innerText =
              format.language[kAppendixAttributionCiteAs] ||
              "For attribution, please cite this work as:";
            contentsDiv.appendChild(citeLabelEl);
            const entry = extractCiteEl(cite.html, doc);
            if (entry) {
              entry.classList.add(kQuartoCiteAsClass);
              contentsDiv.appendChild(entry);
            }
          }
        }, format.language[kSectionTitleCitation] || "Citation");
      }
    }

    // Move any sections that are marked as appendices
    // We do this last so that the other elements will have already been
    // moved from the document and won't inadvertently be captured
    // (for example if the last section is an appendix it could capture
    // the references
    const appendixSectionNodes = doc.querySelectorAll("section.appendix");
    const appendixSectionEls: Element[] = [];
    for (const appendixSectionNode of appendixSectionNodes) {
      const appendSectionEl = appendixSectionNode as Element;

      // Add the whole thing
      if (appendSectionEl) {
        // Remove from the TOC since it appears in the appendix
        if (appendSectionEl.id) {
          const selector = `#TOC a[href="#${appendSectionEl.id}"]`;
          const tocEl = doc.querySelector(selector);
          console.log(selector);
          if (tocEl && tocEl.parentElement) {
            tocEl.parentElement.remove();
          }
        }

        // Extract the header
        const extractHeaderEl = () => {
          const headerEl = appendSectionEl.querySelector(
            "h1, h2, h3, h4, h5, h6",
          );
          // Always hoist any heading up to h2
          if (headerEl) {
            headerEl.remove();
            const h2 = doc.createElement("h2");
            h2.innerHTML = headerEl.innerHTML;
            if (appendSectionEl.id) {
              h2.classList.add("anchored");
            }
            return h2;
          } else {
            const h2 = doc.createElement("h2");
            return h2;
          }
        };
        const headerEl = extractHeaderEl();
        headerEl.classList.add(kAppendixHeadingClass);

        // Move the contents of the section into a div
        const containerDivEl = doc.createElement("DIV");
        containerDivEl.classList.add(
          kAppendixContentsClass,
        );
        while (appendSectionEl.childNodes.length > 0) {
          containerDivEl.appendChild(appendSectionEl.childNodes[0]);
        }

        appendSectionEl.appendChild(headerEl);
        appendSectionEl.appendChild(containerDivEl);
        appendixSectionEls.push(appendSectionEl);
      }
    }
    // Place the user decorated appendixes at the front of the list
    // of appendixes
    if (appendixSectionEls.length > 0) {
      appendixSections.unshift(...appendixSectionEls);
    }

    // Insert the sections
    appendixSections.forEach((el) => {
      appendixEl.appendChild(el);
    });

    // Only add the appendix if it has at least one section
    if (appendixEl.childElementCount > 0) {
      mainEl.appendChild(appendixEl);
    }
  }
}

const kCiteAsStyleBibtex = "bibtex";
const kCiteAsStyleDisplay = "display";

function citeStyleTester(format: Format) {
  const citeStyle = format.metadata[kAppendixCiteAs];
  const resolvedStyles: string[] = [];
  if (citeStyle === undefined || citeStyle === true) {
    resolvedStyles.push(...[kCiteAsStyleDisplay, kCiteAsStyleBibtex]);
  } else {
    if (Array.isArray(citeStyle)) {
      resolvedStyles.push(...citeStyle);
    } else {
      resolvedStyles.push(citeStyle as string);
    }
  }
  return {
    hasCiteAs: () => {
      return resolvedStyles.length > 0;
    },
    hasCiteAsStyle: (style: string) => {
      return resolvedStyles.includes(style);
    },
  };
}

function parseStyle(style?: string) {
  switch (style) {
    case "plain":
      return "plain";
    default:
      return kStyleDefault;
  }
}

const kCcPattern = /(CC BY[^\s]*)\s*(\S*)/;
function creativeCommonsLicense(
  license?: string,
) {
  if (license) {
    const match = license.toUpperCase().match(kCcPattern);
    if (match) {
      const base = match[1];
      const version = match[2];
      if (kAppendixCreativeCommonsLic.includes(base)) {
        return {
          base: base as "CC BY" | "CC BY-SA" | "CC BY-ND" | "CC BY-NC",
          version: version || "4.0",
        };
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

function creativeCommonsUrl(license: string, lang?: string, version?: string) {
  const licenseType = license.substring(3);
  if (lang && lang !== "en") {
    return `https://creativecommons.org/licenses/${licenseType.toLowerCase()}/${version}/deed.${
      lang.toLowerCase().replace("-", "_")
    }`;
  } else {
    return `https://creativecommons.org/licenses/${licenseType.toLowerCase()}/${version}/`;
  }
}

async function generateCite(input: string, format: Format, offset?: string) {
  const citeStyle = citeStyleTester(format);
  if (citeStyle.hasCiteAs()) {
    const { csl } = documentCSL(
      input,
      format.metadata,
      "webpage",
      format.pandoc["output-file"],
      offset,
    );
    if (csl) {
      // Render the HTML and BibTeX form of this document
      const cslPath = getCSLPath(input, format);
      return {
        html: citeStyle.hasCiteAsStyle(kCiteAsStyleDisplay)
          ? await renderHtml(csl, cslPath)
          : undefined,
        bibtex: citeStyle.hasCiteAsStyle(kCiteAsStyleBibtex)
          ? await renderBibTex(csl)
          : undefined,
      };
    } else {
      return undefined;
    }
  } else {
    return {};
  }
}

// The removes any addition left margin markup that is added
// to the rendered citation (e.g. a number or so on)
function extractCiteEl(html: string, doc: Document) {
  const htmlDiv = doc.createElement("DIV");
  htmlDiv.innerHTML = html;
  const entry = htmlDiv.querySelector(".csl-entry");
  if (entry) {
    const leftMarginEl = entry.querySelector(".csl-left-margin");
    if (leftMarginEl) {
      leftMarginEl.remove();
      const rightEl = entry.querySelector(".csl-right-inline");
      if (rightEl) {
        rightEl.classList.remove("csl-right-inline");
      }
    }
    return entry;
  } else {
    return undefined;
  }
}
