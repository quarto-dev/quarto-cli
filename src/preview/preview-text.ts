/*
 * preview-text.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  kBaseFormat,
  kPreviewMode,
  kPreviewModeRaw,
} from "../config/constants.ts";
import { isJatsOutput } from "../config/format.ts";
import { Format } from "../config/types.ts";
import { FileResponse } from "../core/http-types.ts";
import { kTextXml } from "../core/mime.ts";
import { execProcess } from "../core/process.ts";
import {
  formatResourcePath,
  pandocBinaryPath,
  textHighlightThemePath,
} from "../core/resources.ts";

import { basename, extname, join } from "path/mod.ts";

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

export async function previewTextContent(
  file: string,
  inputFile: string,
  format: Format,
  req: Request,
  injectClient: (
    req: Request,
    file: Uint8Array,
    inputFile?: string,
    contentType?: string,
  ) => FileResponse,
) {
  const rawPreviewMode = format.metadata[kPreviewMode] === kPreviewModeRaw;
  if (!rawPreviewMode && isJatsOutput(format.pandoc)) {
    const xml = await jatsPreviewXml(file, req);
    return {
      contentType: kTextXml,
      body: new TextEncoder().encode(xml),
    };
  } else if (
    !rawPreviewMode && format.identifier[kBaseFormat] === "gfm"
  ) {
    const html = await gfmPreview(file, req);
    return injectClient(
      req,
      new TextEncoder().encode(html),
      inputFile,
    );
  } else {
    const html = await textPreviewHtml(file, req);
    const fileContents = new TextEncoder().encode(html);
    return injectClient(req, fileContents, inputFile);
  }
}

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
function darkHighlightStyle(request: Request) {
  const kQuartoPreviewThemeCategory = "quartoPreviewThemeCategory";
  const themeCategory = new URL(request.url).searchParams.get(
    kQuartoPreviewThemeCategory,
  );
  return themeCategory && themeCategory !== "light";
}

// run pandoc and its syntax highlighter over the passed file
// (use the file's extension as its language)
async function textPreviewHtml(file: string, req: Request) {
  // see if we are in dark mode
  const darkMode = darkHighlightStyle(req);
  const backgroundColor = darkMode ? "rgb(30,30,30)" : "#FFFFFF";

  // generate the markdown
  const frontMatter = ["---"];
  frontMatter.push(`pagetitle: "Quarto Preview"`);
  frontMatter.push(`document-css: false`);
  frontMatter.push("---");

  const styles = [
    "```{=html}",
    `<style type="text/css">`,
    `body { margin: 8px 12px; background-color: ${backgroundColor} }`,
    `div.sourceCode { background-color: transparent; }`,
    `</style>`,
    "```",
  ];

  const lang = (extname(file) || ".default").slice(1).toLowerCase();
  const kFence = "````````````````";
  const markdown = frontMatter.join("\n") + "\n\n" +
    styles.join("\n") + "\n\n" +
    kFence + lang + "\n" +
    Deno.readTextFileSync(file) + "\n" +
    kFence;

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [pandocBinaryPath()];
  cmd.push("--to", "html");
  cmd.push(
    "--highlight-style",
    textHighlightThemePath("atom-one", darkMode ? "dark" : "light")!,
  );
  cmd.push("--standalone");
  const result = await execProcess({
    cmd,
    stdout: "piped",
  }, markdown);
  if (result.success) {
    return result.stdout;
  } else {
    throw new Error();
  }
}

async function gfmPreview(file: string, request: Request) {
  const workingDir = Deno.makeTempDirSync();
  try {
    // dark mode?
    const darkMode = darkHighlightStyle(request);

    // Use a custom template that simplifies things
    const template = formatResourcePath("gfm", "template.html");

    // Add a filter
    const filter = formatResourcePath("gfm", "mermaid.lua");

    // Inject Mermaid files
    const mermaidJs = formatResourcePath(
      "html",
      join("mermaid", "mermaid.min.js"),
    );

    // Files to be included verbatim in head
    const includeInHeader: string[] = [];

    // Add JS files
    for (const path of [mermaidJs]) {
      const js = Deno.readTextFileSync(path);
      const contents = `<script type="text/javascript">\n${js}\n</script>`;
      const target = join(workingDir, basename(path));
      Deno.writeTextFileSync(target, contents);
      includeInHeader.push(target);
    }

    // JS init
    const jsInit = `
<script>
  mermaid.initialize({startOnLoad:true, theme: '${
      darkMode ? "dark" : "default"
    }'});
</script>`;

    // Inject custom HTML into the header
    const css = formatResourcePath(
      "gfm",
      join(
        "github-markdown-css",
        darkMode ? "github-markdown-dark.css" : "github-markdown-light.css",
      ),
    );
    const cssTempFile = join(workingDir, "github.css");
    const cssContents = `<style>\n${
      Deno.readTextFileSync(css)
    }\n</style>\n${jsInit}`;
    Deno.writeTextFileSync(cssTempFile, cssContents);
    includeInHeader.push(cssTempFile);

    // Inject GFM style code cell theming
    const highlightPath = textHighlightThemePath(
      "github",
      darkMode ? "dark" : "light",
    );

    const cmd = [pandocBinaryPath()];
    cmd.push("-f");
    cmd.push("gfm");
    cmd.push("-t");
    cmd.push("html");
    cmd.push("--template");
    cmd.push(template);
    includeInHeader.forEach((include) => {
      cmd.push("--include-in-header");
      cmd.push(include);
    });
    cmd.push("--lua-filter");
    cmd.push(filter);
    if (highlightPath) {
      cmd.push("--highlight-style");
      cmd.push(highlightPath);
    }
    const result = await execProcess(
      { cmd, stdout: "piped", stderr: "piped" },
      Deno.readTextFileSync(file),
    );
    if (result.success) {
      return result.stdout;
    } else {
      throw new Error(
        `Failed to render citation: error code ${result.code}\n${result.stderr}`,
      );
    }
  } finally {
    Deno.removeSync(workingDir, { recursive: true });
  }
}
