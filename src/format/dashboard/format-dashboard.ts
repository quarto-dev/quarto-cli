import { kTemplate } from "../../config/constants.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";
import { kPageLayout, kPageLayoutCustom } from "../html/format-html-shared.ts";
import { htmlFormat } from "../html/format-html.ts";

export function dashboardFormat() {
  return mergeConfigs(
    htmlFormat(7, 5),
    {
      metadata: {
        [kPageLayout]: kPageLayoutCustom,
        [kTemplate]: formatResourcePath("dashboard", "template.html"),
      },
    },
  );
}

registerWriterFormatHandler((format) => {
  switch (format) {
    case "dashboard":
      return {
        format: dashboardFormat(),
        pandocTo: "html",
      };
  }
});
