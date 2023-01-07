/*
* format-html-embed.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { formatResourcePath } from "../../core/resources.ts";
import { renderEjs } from "../../core/ejs.ts";

import { kOutputFile, kTemplate, kTheme } from "../../config/constants.ts";
import { Format } from "../../config/types.ts";

import { RenderServices } from "../../command/render/types.ts";
import { render } from "../../command/render/render-shared.ts";

import { basename, dirname, join } from "path/mod.ts";

export interface HtmlPreview {
  title: string;
  path: string;
}

export async function renderHtmlPreview(
  path: string,
  format: Format,
  services: RenderServices,
): Promise<HtmlPreview> {
  const filename = basename(path);
  const title = filename;

  // Use the special `embed` template for this render
  const embedHtmlEjs = formatResourcePath(
    "html",
    join("embed", "template.ejs.html"),
  );
  const embedTemplate = renderEjs(embedHtmlEjs, {
    title,
    path,
    filename,
  });
  const templatePath = services.temp.createFile({ suffix: "html" });
  Deno.writeTextFileSync(templatePath, embedTemplate);

  // Rebder the notebook and update the path
  const nbPreviewFile = `${filename}.html`;
  await render(path, {
    services,
    flags: {
      metadata: {
        [kTheme]: format.metadata[kTheme],
        [kOutputFile]: nbPreviewFile,
        [kTemplate]: templatePath,
      },
      quiet: false,
    },
  });

  return {
    title,
    path: join(dirname(path), nbPreviewFile),
  };
}
