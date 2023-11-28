import { mergeConfigs } from "../../core/config.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";
import { htmlFormat } from "../html/format-html.ts";

export function emailFormat() {
  return mergeConfigs(
    htmlFormat(7, 5),
  );
}

registerWriterFormatHandler((format) => {
  switch (format) {
    case "email":
      return {
        format: emailFormat(),
        pandocTo: "html",
      };
  }
});
