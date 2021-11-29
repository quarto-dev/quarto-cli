/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element, NodeType } from "deno_dom/deno-dom-wasm-noinit.ts";
import {
  kCodeLineNumbers,
  kFrom,
  kHtmlMathMethod,
  kIncludeInHeader,
  kLinkCitations,
  kSlideLevel,
} from "../../config/constants.ts";

import {
  Format,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kTemplatePatches,
  kTextHighlightingMode,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { camelToKebab, kebabToCamel, mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { renderEjs } from "../../core/ejs.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";
import { pandocFormatWith } from "../../core/pandoc/pandoc-formats.ts";
import { htmlFormatExtras } from "../html/format-html.ts";
import { revealPluginExtras } from "./format-reveal-plugin.ts";
import { revealTheme } from "./format-reveal-theme.ts";
import {
  revealMuliplexPreviewFile,
  revealMultiplexExtras,
} from "./format-reveal-multiplex.ts";

const kRevealOptions = [
  "controls",
  "controlsTutorial",
  "controlsLayout",
  "controlsBackArrows",
  "progress",
  "slideNumber",
  "showSlideNumber",
  "hash",
  "hashOneBasedIndex",
  "respondToHashChanges",
  "history",
  "keyboard",
  "overview",
  "disableLayout",
  "center",
  "touch",
  "loop",
  "rtl",
  "navigationMode",
  "shuffle",
  "fragments",
  "fragmentInURL",
  "embedded",
  "help",
  "pause",
  "showNotes",
  "autoPlayMedia",
  "preloadIframes",
  "autoSlide",
  "autoSlideStoppable",
  "autoSlideMethod",
  "defaultTiming",
  "mouseWheel",
  "display",
  "hideInactiveCursor",
  "hideCursorTime",
  "previewLinks",
  "transition",
  "transitionSpeed",
  "backgroundTransition",
  "viewDistance",
  "mobileViewDistance",
  "parallaxBackgroundImage",
  "parallaxBackgroundSize",
  "parallaxBackgroundHorizontal",
  "parallaxBackgroundVertical",
  "width",
  "height",
  "margin",
  "minScale",
  "maxScale",
  "mathjax",
  "pdfSeparateFragments",
  "autoAnimateEasing",
  "autoAnimateDuration",
  "autoAnimateUnmatched",
];

const kRevealKebabOptions = optionsToKebab(kRevealOptions);

export const kRevealJsUrl = "revealjs-url";
export const kRevealJsConfig = "revealjs-config";

export const kSlideLogo = "logo";
export const kSlideFooter = "footer";
export const kHashType = "hash-type";
export const kScrollable = "scrollable";
export const kCenterTitleSlide = "center-title-slide";
export const kControlsAuto = "controlsAuto";
export const kPreviewLinksAuto = "previewLinksAuto";
export const kPdfSeparateFragments = "pdfSeparateFragments";
export const kAutoAnimateEasing = "autoAnimateEasing";
export const kAutoAnimateDuration = "autoAnimateDuration";
export const kAutoAnimateUnmatched = "autoAnimateUnmatched";

export function optionsToKebab(options: string[]) {
  return options.reduce(
    (options: string[], option: string) => {
      const kebab = camelToKebab(option);
      if (kebab !== option) {
        options.push(kebab);
      }
      return options;
    },
    [],
  );
}

export function revealResolveFormat(format: Format) {
  format.metadata = revealMetadataFilter(format.metadata);

  // map "vertical" navigation mode to "default"
  if (format.metadata["navigationMode"] === "vertical") {
    format.metadata["navigationMode"] = "default";
  }
}

export function injectRevealConfig(
  config: Record<string, unknown>,
  template: string,
) {
  // plugin config
  const configJs: string[] = [];
  Object.keys(config).forEach((key) => {
    configJs.push(`'${key}': ${JSON.stringify(config[key])}`);
  });
  if (configJs.length > 0) {
    const kRevealInitialize = "Reveal.initialize({";
    template = template.replace(
      kRevealInitialize,
      kRevealInitialize + "\n" + configJs.join(",\n") + ",\n",
    );
  }
  return template;
}

export function revealMetadataFilter(
  metadata: Metadata,
  kebabOptions = kRevealKebabOptions,
) {
  // convert kebab case to camel case for reveal options
  const filtered: Metadata = {};
  Object.keys(metadata).forEach((key) => {
    const value = metadata[key];
    if (
      kebabOptions.includes(key)
    ) {
      filtered[kebabToCamel(key)] = value;
    } else {
      filtered[key] = value;
    }
  });
  return filtered;
}

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat(10, 5),
    {
      pandoc: {
        [kHtmlMathMethod]: {
          method: "mathjax",
          url:
            "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.0/MathJax.js?config=TeX-AMS_HTML-full",
        },
        [kSlideLevel]: 2,
      },
      render: {
        [kCodeLineNumbers]: true,
      },
      resolveFormat: revealResolveFormat,
      formatPreviewFile: revealMuliplexPreviewFile,
      formatExtras: async (
        input: string,
        flags: PandocFlags,
        format: Format,
        libDir: string,
      ) => {
        // render styles template based on options
        const stylesFile = sessionTempFile({ suffix: ".html" });
        const styles = renderEjs(
          formatResourcePath("revealjs", "styles.html"),
          { [kScrollable]: format.metadata[kScrollable] },
        );
        Deno.writeTextFileSync(stylesFile, styles);

        // specify controlsAuto if there is no boolean 'controls'
        const metadataOverride: Metadata = {};
        const controlsAuto = typeof (format.metadata["controls"]) !== "boolean";
        if (controlsAuto) {
          metadataOverride.controls = false;
        }

        // specify previewLinksAuto if there is no boolean 'previewLinks'
        const previewLinksAuto = format.metadata["previewLinks"] === "auto";
        if (previewLinksAuto) {
          metadataOverride.previewLinks = false;
        }

        // additional options not supported by pandoc
        const extraConfigPatch = (template: string) => {
          const extraConfig = {
            [kControlsAuto]: controlsAuto,
            [kPreviewLinksAuto]: previewLinksAuto,
            [kPdfSeparateFragments]: !!format.metadata[kPdfSeparateFragments],
            [kAutoAnimateEasing]: format.metadata[kAutoAnimateEasing] || "ease",
            [kAutoAnimateDuration]: format.metadata[kAutoAnimateDuration] ||
              1.0,
            [kAutoAnimateUnmatched]:
              format.metadata[kAutoAnimateUnmatched] !== undefined
                ? format.metadata[kAutoAnimateUnmatched]
                : true,
          };
          return injectRevealConfig(extraConfig, template);
        };

        // start with html format extras and our standard  & plugin extras
        let extras = mergeConfigs(
          // extras for all html formats
          htmlFormatExtras(format, {
            tabby: true,
            anchors: false,
            copyCode: true,
            hoverCitations: true,
            hoverFootnotes: true,
            figResponsive: false,
          }, // tippy options
          {
            theme: "quarto-reveal",
            parent: "section.slide",
            config: {
              offset: [0, 0],
            },
          }, {
            quartoBase: false,
          }),
          // default extras for reveal
          {
            args: [],
            pandoc: {},
            metadata: {
              [kLinkCitations]: true,
            } as Metadata,
            metadataOverride,
            [kIncludeInHeader]: [stylesFile],
            html: {
              [kTemplatePatches]: [
                extraConfigPatch,
                revealRequireJsPatch,
                /* TODO: Remove when the fix is available in Pandoc https://github.com/jgm/pandoc/pull/7670 */
                (template: string) => {
                  template = template.replace(
                    /(disableLayout: )false/,
                    "$1$disableLayout$",
                  );
                  return template;
                },
              ],
              [kHtmlPostprocessors]: [
                revealHtmlPostprocessor(format),
              ],
              [kMarkdownAfterBody]: [revealMarkdownAfterBody(format)],
            },
          },
        );

        // get theme info (including text highlighing mode)
        const theme = await revealTheme(format, input, libDir);
        extras.metadataOverride = {
          ...extras.metadataOverride,
          ...theme.metadata,
        };
        extras.html![kTextHighlightingMode] = theme[kTextHighlightingMode];

        const revealPluginExtrasConfig = await revealPluginExtras(
          format,
          flags,
          theme.revealUrl,
          theme.revealDestDir,
        );

        // add plugins
        extras = mergeConfigs(
          revealPluginExtrasConfig,
          extras,
        );

        // add multiplex if we have it
        const multiplexExtras = revealMultiplexExtras(format);
        if (multiplexExtras) {
          extras = mergeConfigs(extras, multiplexExtras);
        }

        // provide alternate defaults unless the user requests revealjs defaults
        if (format.metadata[kRevealJsConfig] !== "default") {
          // detect whether we are using vertical slides
          const navigationMode = format.metadata["navigationMode"];
          const verticalSlides = navigationMode === "default" ||
            navigationMode === "grid";

          // if the user set slideNumber to true then provide
          // linear slides (if they havne't specified vertical slides)
          if (format.metadata["slideNumber"] === true) {
            extras.metadataOverride!["slideNumber"] = verticalSlides
              ? "h.v"
              : "c/t";
          }

          // opinionated version of reveal config defaults
          extras.metadata = {
            ...extras.metadata,
            ...revealMetadataFilter({
              width: 1050,
              height: 700,
              margin: 0.1,
              center: false,
              navigationMode: "linear",
              controlsLayout: "edges",
              controlsTutorial: false,
              hash: true,
              history: true,
              hashOneBasedIndex: false,
              fragmentInURL: false,
              transition: "none",
              backgroundTransition: "none",
              pdfSeparateFragments: false,
            }),
          };
        }

        // hash-type: number (as shorthand for -auto_identifiers)
        if (format.metadata[kHashType] === "number") {
          extras.pandoc = {
            ...extras.pandoc,
            from: pandocFormatWith(
              format.pandoc[kFrom] || "markdown",
              "",
              "-auto_identifiers",
            ),
          };
        }

        // return extras
        return extras;
      },
    },
  );
}

const kRevelJsRegEx =
  /(<script src="\$revealjs-url\$\/dist\/reveal.js"><\/script>)/m;

function revealRequireJsPatch(template: string) {
  // fix require usages to be compatible with jupyter widgets
  template = template.replace(
    kRevelJsRegEx,
    "<script>window.backupDefine = window.define; window.define = undefined;</script>\n  $1",
  );
  template = template.replace(
    /(<script src="\$revealjs-url\$\/plugin\/math\/math.js"><\/script>(?:\r?\n|\r)\$endif\$)/,
    "$1\n  <script>window.define = window.backupDefine; window.backupDefine = undefined;</script>\n",
  );
  return template;
}

function revealMarkdownAfterBody(format: Format) {
  const lines: string[] = [];
  if (format.metadata[kSlideLogo]) {
    lines.push(
      `<img src="${format.metadata[kSlideLogo]}" class="slide-logo" />`,
    );
    lines.push("\n");
  }
  lines.push("::: {.footer .footer-default}");
  if (format.metadata[kSlideFooter]) {
    lines.push(String(format.metadata[kSlideFooter]));
  } else {
    lines.push("");
  }
  lines.push(":::");
  lines.push("\n");

  return lines.join("\n");
}

function revealHtmlPostprocessor(format: Format) {
  return (doc: Document): Promise<string[]> => {
    // find reveal initialization and perform fixups
    const scripts = doc.querySelectorAll("script");
    for (const script of scripts) {
      const scriptEl = script as Element;
      if (
        scriptEl.innerText &&
        scriptEl.innerText.indexOf("Reveal.initialize({") !== -1
      ) {
        // quote slideNumber
        scriptEl.innerText = scriptEl.innerText.replace(
          /slideNumber: (h[\.\/]v|c(?:\/t)?)/,
          "slideNumber: '$1'",
        );
      }
    }

    // remove all attributes from slide headings (pandoc has already moved
    // them to the enclosing section)
    const slideLevel = format.pandoc[kSlideLevel] || 2;
    const slideHeadingTags = Array.from(Array(slideLevel)).map((_e, i) =>
      "H" + (i + 1)
    );
    const slideHeadings = doc.querySelectorAll("section.slide > :first-child");
    slideHeadings.forEach((slideHeading) => {
      const slideHeadingEl = slideHeading as Element;
      if (slideHeadingTags.includes(slideHeadingEl.tagName)) {
        // remove attributes
        for (const attrib of slideHeadingEl.getAttributeNames()) {
          slideHeadingEl.removeAttribute(attrib);
          // if it's auto-animate then do some special handling
          if (attrib === "data-auto-animate") {
            // link slide titles for animation
            slideHeadingEl.setAttribute("data-id", "quarto-animate-title");
            // add animation id to code blocks
            const codeBlocks = slideHeadingEl.parentElement?.querySelectorAll(
              "div.sourceCode > pre > code",
            );
            if (codeBlocks?.length === 1) {
              const codeEl = codeBlocks.item(0) as Element;
              const preEl = codeEl.parentElement!;
              preEl.setAttribute(
                "data-id",
                "quarto-animate-code",
              );
              // markup with highlightjs classes so that are sucessfully targeted by
              // autoanimate.js
              codeEl.classList.add("hljs");
              codeEl.childNodes.forEach((spanNode) => {
                if (spanNode.nodeType === NodeType.ELEMENT_NODE) {
                  const spanEl = spanNode as Element;
                  spanEl.classList.add("hljs-ln-code");
                }
              });
            }
          }
        }
      }
    });

    // center title slide if requested
    // note that disabling title slide centering when the rest of the
    // slides are centered doesn't currently work b/c reveal consults
    // the global 'center' config as well as the class. to overcome
    // this we'd need to always set 'center: false` and then
    // put the .center classes onto each slide manually. we're not
    // doing this now the odds a user would want all of their
    // slides cnetered but NOT the title slide are close to zero
    if (format.metadata[kCenterTitleSlide] !== false) {
      const titleSlide = doc.getElementById("title-slide") as Element;
      if (titleSlide) {
        titleSlide.classList.add("center");
      }
      const titleSlides = doc.querySelectorAll(".title-slide");
      for (const slide of titleSlides) {
        (slide as Element).classList.add("center");
      }
    }

    // disable footnote and citation links (we use a popup for them)
    const notes = doc.querySelectorAll('a[role="doc-noteref"]');
    for (const note of notes) {
      const noteEl = note as Element;
      noteEl.setAttribute("onclick", "return false;");
    }
    const cites = doc.querySelectorAll('a[role="doc-biblioref"');
    for (const cite of cites) {
      const citeEl = cite as Element;
      citeEl.setAttribute("onclick", "return false;");
    }

    // create hidden reveal-references div at the bottom of the document
    // and move pandoc generated footnotes and bibliography into it
    // (it will be used as the content source by reference popups)
    const referencesDiv = doc.createElement("div");
    referencesDiv.classList.add("reveal-references");
    doc.body.appendChild(referencesDiv);
    const endnotes = doc.querySelectorAll('section[role="doc-endnotes"]');
    for (const endnoteSection of endnotes) {
      referencesDiv.appendChild(endnoteSection);
    }
    const refs = doc.querySelector("#refs");
    if (refs) {
      referencesDiv.appendChild(refs);
    }

    return Promise.resolve([]);
  };
}
