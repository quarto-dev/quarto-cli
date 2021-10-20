/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import { kFrom, kIncludeInHeader, kTheme } from "../../config/constants.ts";

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
import { copyMinimal, pathWithForwardSlashes } from "../../core/path.ts";
import { htmlFormatExtras } from "../html/format-html.ts";
import { revealPluginExtras } from "./format-reveal-plugin.ts";

const kRevealJsUrl = "revealjs-url";

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

const kRevealLightThemes = [
  "white",
  "beige",
  "sky",
  "serif",
  "simple",
  "solarized",
];

const kRevealDarkThemes = [
  "black",
  "league",
  "night",
  "blood",
  "moon",
];

const kRevealThemes = [...kRevealLightThemes, ...kRevealDarkThemes];

const kHashType = "hash-type";

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

export function revealjsFormat() {
  return mergeConfigs(
    createHtmlPresentationFormat(9, 5),
    {
      metadataFilter: revealMetadataFilter,
      formatExtras: (
        _input: string,
        _flags: PandocFlags,
        format: Format,
        libDir: string,
      ) => {
        // start with html format extras and our standard  & plugin extras
        const extras = mergeConfigs(
          // extras for all html formats
          htmlFormatExtras(format),
          // default extras for reveal
          {
            args: [],
            pandoc: {},
            metadata: {} as Metadata,
            [kIncludeInHeader]: [],
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

        // if there is no revealjs-url provided then use our embedded copy
        if (format.metadata[kRevealJsUrl] === undefined) {
          const revealDir = join(libDir, "reveal");
          copyMinimal(formatResourcePath("revealjs", "reveal"), revealDir);
          extras.metadata![kRevealJsUrl] = pathWithForwardSlashes(revealDir);
        }

        // provide alternate defaults when no explicit reveal theme is provided
        const dark = format.metadata[kTheme] &&
          kRevealDarkThemes.includes(format.metadata[kTheme] as string);
        if (
          format.metadata[kTheme] === undefined ||
          !kRevealThemes.includes(format.metadata[kTheme] as string)
        ) {
          // hash-type number
          if (
            format.metadata[kHashType] === undefined ||
            format.metadata[kHashType] === "number"
          ) {
            extras.pandoc = {
              ...extras.pandoc,
              from: pandocFormatWith(
                format.pandoc[kFrom] || "markdown",
                "",
                "-auto_identifiers",
              ),
            };
          }

          // other defaults
          extras.metadata = {
            ...extras.metadata,
            ...revealMetadataFilter({
              theme: "white",
              width: 1050,
              height: 700,
              center: false,
              controlsTutorial: false,
              hash: true,
              fragmentInURL: false,
              hashOneBasedIndex: true,
              transition: "none",
              backgroundTransition: "none",
            }),
          };
        }

        // provide default highlighting style
        extras.html![kTextHighlightingMode] = dark ? "dark" : "light";

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

    return Promise.resolve([]);
  };
}
