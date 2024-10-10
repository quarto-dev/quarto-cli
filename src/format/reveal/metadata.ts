/*
 * metadata.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
 */

import { Metadata } from "../../config/types.ts";
import { camelToKebab, kebabToCamel } from "../../core/config.ts";
import {
  kAutoAnimateDuration,
  kAutoAnimateEasing,
  kAutoAnimateUnmatched,
  kJumpToSlide,
  kPdfMaxPagesPerSlide,
  kPdfSeparateFragments,
  kScrollActivationWidth,
  kScrollLayout,
  kScrollProgress,
  kScrollSnap,
  kView,
} from "./constants.ts";

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

export function revealMetadataFilter(
  metadata: Metadata,
  kebabOptions = kRevealKebabOptions,
) {
  // this is, more-or-less, an admission of defeat.
  // By inspection of src/resources/schema/document-reveal-*.yml we can see
  // that this is the only case where camel case is
  // used inconsistently by revealJS (we should have fragmentInUrl instead of fragmentInURL).
  //
  // https://github.com/quarto-dev/quarto-cli/issues/7358
  const mappingExceptions: Record<string, string> = {
    "fragment-in-url": "fragmentInURL",
  };
  // convert kebab case to camel case for reveal options
  const filtered: Metadata = {};
  Object.keys(metadata).forEach((key) => {
    const value = metadata[key];
    if (
      kebabOptions.includes(key)
    ) {
      const camel = mappingExceptions[key] || kebabToCamel(key);
      filtered[camel] = value;
    } else {
      filtered[key] = value;
    }
  });
  return filtered;
}

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
  "autoAnimate",
  "autoAnimateMatcher",
  kAutoAnimateEasing,
  kAutoAnimateDuration,
  kAutoAnimateUnmatched,
  "autoAnimateStyles",
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
  kPdfMaxPagesPerSlide,
  kPdfSeparateFragments,
  "pdfPageHeightOffset",
  kJumpToSlide,
  kView,
  kScrollProgress,
  kScrollSnap,
  kScrollLayout,
  kScrollActivationWidth,
];

const kRevealKebabOptions = optionsToKebab(kRevealOptions);
