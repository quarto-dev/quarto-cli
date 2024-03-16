import { Format } from "../../config/types.ts";
import { formatResourcePath } from "../../core/resources.ts";

import { join } from "../../deno_ral/path.ts";
import { sassLayer } from "../../core/sass.ts";

const kStylePandoc = "pandoc";

export function titleSlidePartial(format: Format) {
  // Swap in the correct title slide implementation
  if (isLegacyTitleStyle(format)) {
    return "title-slide.html";
  } else {
    return "title-fancy/title-slide.html";
  }
}

export function titleSlideScss(format: Format) {
  // Swap in the correct title slide implementation
  if (isLegacyTitleStyle(format)) {
    return undefined;
  } else {
    const titleBlockScss = formatResourcePath(
      "revealjs",
      join("pandoc", "title-fancy/title-slide.scss"),
    );
    return sassLayer(titleBlockScss);
  }
}

function isLegacyTitleStyle(format: Format) {
  return format.metadata["title-slide-style"] === kStylePandoc;
}
