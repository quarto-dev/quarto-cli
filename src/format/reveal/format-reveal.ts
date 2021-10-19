/*
* format-reveal.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { basename, join } from "path/mod.ts";

import { Document, Element } from "deno_dom/deno-dom-wasm-noinit.ts";
import {
  kFrom,
  kHighlightStyle,
  kIncludeInHeader,
  kTheme,
} from "../../config/constants.ts";

import {
  Format,
  FormatExtras,
  kHtmlPostprocessors,
  kTemplatePatches,
  Metadata,
  PandocFlags,
} from "../../config/types.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { createHtmlPresentationFormat } from "../formats-shared.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { pandocFormatWith } from "../../core/pandoc/pandoc-formats.ts";

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

const kRevealThemes = [
  "black",
  "white",
  "league",
  "beige",
  "sky",
  "night",
  "serif",
  "simple",
  "solarized",
  "blood",
  "moon",
];

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
      formatExtras: (_input: string, _flags: PandocFlags, format: Format) => {
        // start with baseline extras that we always apply
        const extras: FormatExtras = {
          args: [],
          pandoc: {},
          metadata: {},
          [kIncludeInHeader]: [],
          html: {
            [kTemplatePatches]: [revealRequireJsPatch],
            [kHtmlPostprocessors]: [
              revealInitializeHtmlPostprocessor(),
            ],
          },
        };

        // replace pandoc highlighting with highlight.js
        extras.args?.push("--no-highlight");
        extras[kIncludeInHeader]?.push(
          revealHighlightStyleHeaderInclude(format),
        );
        extras.html?.[kTemplatePatches]?.push(revealHighlightPatch);
        extras.html?.[kHtmlPostprocessors]?.push(
          revealHighlightHtmlPostprocessor(),
        );

        // provide alternate defaults when no explicit reveal theme is provided
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
              center: false,
              controlsTutorial: false,
              hash: true,
              hashOneBasedIndex: true,
              transition: "none",
              backgroundTransition: "none",
            }),
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
const kRevealJsPlugins = "<!-- reveal.js plugins -->";

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

function revealHighlightPatch(template: string) {
  template = template.replace(
    kRevealJsPlugins,
    kRevealJsPlugins +
      '\n  <script src="$revealjs-url$/plugin/highlight/highlight.js"></script>',
  );
  template = template.replace(
    "plugins: [",
    "plugins: [ RevealHighlight,\n",
  );
  return template;
}

function revealHighlightStyleHeaderInclude(format: Format) {
  // check for a highlight style
  const highlightStyle = format.pandoc[kHighlightStyle] || "a11y-light";

  // is it a built-in one?
  const highlightStyleResource = formatResourcePath(
    "revealjs",
    join("highlight", highlightStyle + ".css"),
  );
  const highlightStyleFile = existsSync(highlightStyleResource)
    ? highlightStyleResource
    : highlightStyle;
  if (!existsSync(highlightStyleFile)) {
    throw new Error(
      `Highlight style ${basename(highlightStyleFile)} not found.`,
    );
  }

  const styleHeaderInclude = sessionTempFile({ suffix: ".html" });
  Deno.writeTextFileSync(
    styleHeaderInclude,
    `<style type="text/css">\n${
      Deno.readTextFileSync(highlightStyleFile)
    }\n</style>\n`,
  );
  return styleHeaderInclude;
}

function revealHighlightHtmlPostprocessor() {
  return (doc: Document): Promise<string[]> => {
    const codeElements = doc.querySelectorAll("code");
    for (let i = 0; i < codeElements.length; i++) {
      const codeEl = codeElements.item(i) as Element;
      if (codeEl.parentElement?.tagName === "PRE") {
        codeEl.className = "language-" + codeEl.parentElement.className;
      }
    }

    return Promise.resolve([]);
  };
}

function camelToKebab(camel: string) {
  const kebab: string[] = [];
  for (let i = 0; i < camel.length; i++) {
    const ch = camel.charAt(i);
    if (ch === ch.toUpperCase()) {
      kebab.push("-");
      kebab.push(ch.toLowerCase());
    } else {
      kebab.push(ch);
    }
  }
  return kebab.join("");
}

function kebabToCamel(kebab: string) {
  const camel: string[] = [];
  for (let i = 0; i < kebab.length; i++) {
    const ch = kebab.charAt(i);
    if (ch === "-") {
      camel.push(kebab.charAt(++i).toUpperCase());
    } else {
      camel.push(ch);
    }
  }
  return camel.join("");
}
