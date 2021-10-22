/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import {
  kFrom,
  kIncludeInHeader,
  kLinkCitations,
} from "../../config/constants.ts";

import {
  Format,
  kHtmlPostprocessors,
  kTemplatePatches,
  kTextHighlightingMode,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { camelToKebab, kebabToCamel, mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";
import { pandocFormatWith } from "../../core/pandoc/pandoc-formats.ts";
import { htmlFormatExtras } from "../html/format-html.ts";
import { revealPluginExtras } from "./format-reveal-plugin.ts";
import { revealTheme } from "./format-reveal-theme.ts";

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
];

const kRevealKebabOptions = kRevealOptions.reduce(
  (options: string[], option: string) => {
    const kebab = camelToKebab(option);
    if (kebab !== option) {
      options.push(kebab);
    }
    return options;
  },
  [],
);

export const kRevealJsUrl = "revealjs-url";
export const kRevealJsConfig = "revealjs-config";

export const kHashType = "hash-type";

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat(9, 5),
    {
      metadataFilter: revealMetadataFilter,
      formatExtras: async (
        _input: string,
        _flags: PandocFlags,
        format: Format,
        libDir: string,
      ) => {
        // start with html format extras and our standard  & plugin extras
        const extras = mergeConfigs(
          // extras for all html formats
          htmlFormatExtras(format, {
            copyCode: true,
            hoverCitations: true,
            hoverFootnotes: true,
            tippyTheme: "quarto-reveal",
          }),
          // default extras for reveal
          {
            args: [],
            pandoc: {},
            metadata: {
              [kLinkCitations]: true,
            } as Metadata,
            metadataOverride: {} as Metadata,
            [kIncludeInHeader]: [formatResourcePath("revealjs", "styles.html")],
            html: {
              [kTemplatePatches]: [revealRequireJsPatch],
              [kHtmlPostprocessors]: [
                revealInitializeHtmlPostprocessor(),
              ],
            },
          },
          // plugin extras
          revealPluginExtras(format, libDir),
        );

        // get theme info (including text highlighing mode)
        const theme = await revealTheme(format, libDir);
        extras.metadataOverride = {
          ...extras.metadataOverride,
          ...theme.metadata,
        };
        extras.html![kTextHighlightingMode] = theme[kTextHighlightingMode];

        // provide alternate defaults unless the user requests revealjs defaults
        if (format.metadata[kRevealJsConfig] !== "default") {
          // opinionated version of reveal config defaults
          extras.metadata = {
            ...extras.metadata,
            ...revealMetadataFilter({
              width: 1050,
              height: 700,
              margin: 0.1,
              center: false,
              controlsTutorial: false,
              hash: true,
              hashOneBasedIndex: true,
              fragmentInURL: false,
              transition: "none",
              backgroundTransition: "none",
            }),
          };
        }

        // hash-type: number (as shorthand for -auto_identifiers)
        if (format.metadata[kHashType] !== "id") {
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
    /(<script src="\$revealjs-url\$\/plugin\/math\/math.js"><\/script>\n\$endif\$)/,
    "$1\n  <script>window.define = window.backupDefine; window.backupDefine = undefined;</script>\n",
  );
  return template;
}

function revealMetadataFilter(metadata: Metadata) {
  // convert kebab case to camel case for reveal options
  const filtered: Metadata = {};
  Object.keys(metadata).forEach((key) => {
    const value = metadata[key];
    if (
      kRevealKebabOptions.includes(key)
    ) {
      filtered[kebabToCamel(key)] = value;
    } else {
      filtered[key] = value;
    }
  });
  return filtered;
}

function revealInitializeHtmlPostprocessor() {
  return (doc: Document): Promise<string[]> => {
    // find reveal initializatio and perform fixups
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
    const endnotes = doc.querySelector('section[role="doc-endnotes"]');
    if (endnotes) {
      referencesDiv.appendChild(endnotes);
    }
    const refs = doc.querySelector("#refs");
    if (refs) {
      referencesDiv.appendChild(refs);
    }

    return Promise.resolve([]);
  };
}
