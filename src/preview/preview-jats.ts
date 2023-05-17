/*
 * preview-jats.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

export const jatsStaticResources = () => {
  return [
    {
      name: "quarto-jats-preview.css",
      dir: "jats",
      contentType: "text/css",
    },
    {
      name: "quarto-jats-html.xsl",
      dir: "jats",
      contentType: "text/xsl",
      injectClient: (contents: string, client: string) => {
        const protectedClient = client.replaceAll(
          /(<style.*?>)|(<script.*?>)/g,
          (substring: string) => {
            return `${substring}\n<![CDATA[`;
          },
        ).replaceAll(
          /(<\/style.*?>)|(<\/script.*?>)/g,
          (substring: string) => {
            return `]]>\n${substring}`;
          },
        ).replaceAll("data-micromodal-close", 'data-micromodal-close="true"');

        const bodyContents = contents.replace(
          "<!-- quarto-after-body -->",
          protectedClient,
        );
        return new TextEncoder().encode(bodyContents);
      },
    },
  ];
};

export async function jatsPreviewXml(file: string, _request: Request) {
  const fileContents = await Deno.readTextFile(file);

  // Attach the stylesheet
  let xmlContents = fileContents.replace(
    /<\?xml version="1.0" encoding="utf-8"\s*\?>/,
    '<?xml version="1.0" encoding="utf-8" ?>\n<?xml-stylesheet href="quarto-jats-html.xsl" type="text/xsl" ?>',
  );

  // Strip the DTD to disable the fetching of the DTD and validation (for preview)
  xmlContents = xmlContents.replace(
    /<!DOCTYPE((.|\n)*?)>/,
    "",
  );
  return xmlContents;
}
