/*
* mermaid.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  LanguageCellHandlerContext,
  LanguageCellHandlerOptions,
  LanguageHandler,
} from "./types.ts";
import { baseHandler, install } from "./base.ts";
import { formatResourcePath } from "../resources.ts";
import { join } from "path/mod.ts";
import {
  isJavascriptCompatible,
  isLatexOutput,
  isMarkdownOutput,
  isRevealjsOutput,
} from "../../config/format.ts";
import { QuartoMdCell } from "../lib/break-quarto-md.ts";
import { asMappedString, mappedConcat } from "../lib/mapped-text.ts";
import {
  fixupAlignment,
  makeResponsive,
  resolveSize,
  setSvgSize,
} from "../svg.ts";
import {
  kFigAlign,
  kFigHeight,
  kFigResponsive,
  kFigWidth,
  kIncludeAfterBody,
  kMermaidFormat,
} from "../../config/constants.ts";
import { Element } from "../deno-dom.ts";
import { convertFromYaml } from "../lib/yaml-schema/from-yaml.ts";
import { readYamlFromString } from "../yaml.ts";
import { pandocHtmlBlock, pandocRawStr } from "../pandoc/codegen.ts";

const mermaidHandler: LanguageHandler = {
  ...baseHandler,

  schema() {
    return Promise.resolve(convertFromYaml(readYamlFromString(`
object:
  properties:
    mermaid-format:
      enum: [png, svg, js]
`)));
  },

  type: "cell",
  stage: "post-engine",

  languageName: "mermaid",
  languageClass: (options: LanguageCellHandlerOptions) => {
    if (isMarkdownOutput(options.format.pandoc, ["gfm"])) {
      return "mermaid-source"; // sidestep github's in-band signaling of mermaid diagrams
    } else {
      return "default"; // no pandoc highlighting yet so we use 'default' to get grey shading
    }
  },

  defaultOptions: {
    echo: false,
    eval: true,
    include: true,
  },

  comment: "%%",

  async cell(
    handlerContext: LanguageCellHandlerContext,
    cell: QuartoMdCell,
    options: Record<string, unknown>,
  ) {
    const cellContent = handlerContext.cellContent(cell);
    // create puppeteer target page
    const content = `<html>
    <head>
    <script src="./mermaid.min.js"></script>
    </head>
    <body>
    <pre class="mermaid">\n${cellContent.value}\n</pre>
    <script>
    mermaid.initialize();
    </script>
    </html>`;
    const selector = "pre.mermaid svg";
    const resources: [string, string][] = [[
      "mermaid.min.js",
      Deno.readTextFileSync(
        formatResourcePath("html", join("mermaid", "mermaid.min.js")),
      ),
    ]];

    const setupMermaidJsRuntime = () => {
      if (handlerContext.getState().hasSetupMermaidJsRuntime) {
        return;
      }
      handlerContext.getState().hasSetupMermaidJsRuntime = true;

      handlerContext.addHtmlDependency(
        "script",
        {
          name: "mermaid.min.js",
          path: formatResourcePath("html", join("mermaid", "mermaid.min.js")),
        },
      );

      handlerContext.addInclude(
        `<script>
        mermaid.initialize({ startOnLoad: false });
        window.addEventListener(
          'load',
          function () {
            mermaid.init("div.cell-output-display pre.mermaid");
          },
          false
        );
        </script>`,
        kIncludeAfterBody,
      );
    };

    const makeFigLink = (
      sourceName: string,
      width?: number,
      height?: number,
      includeCaption?: boolean,
    ) => {
      const posSpecifier = isLatexOutput(handlerContext.options.format.pandoc)
        ? " fig-pos='H'"
        : "";
      const idSpecifier = (cell.options?.label && includeCaption)
        ? ` #${cell.options?.label}`
        : "";
      const widthSpecifier = width
        ? `width="${Math.round(width * 100) / 100}in"`
        : "";
      const heightSpecifier = height
        ? ` height="${Math.round(height * 100) / 100}in"`
        : "";
      const captionSpecifier = includeCaption
        ? (cell.options?.["fig-cap"] || "")
        : "";

      return `\n![${captionSpecifier}](${sourceName}){${widthSpecifier}${heightSpecifier}${posSpecifier}${idSpecifier}}\n`;
    };

    const makeSvg = async () => {
      let svg = asMappedString(
        (await handlerContext.extractHtml({
          html: content,
          selector,
          resources,
        }))[0],
      );
      const responsive = handlerContext.options.context.format.metadata
        ?.[kFigResponsive];

      const fixupRevealAlignment = (svg: Element) => {
        if (isRevealjsOutput(handlerContext.options.context.format.pandoc)) {
          const align = (options?.[kFigAlign] as string) ?? "center";
          fixupAlignment(svg, align);
        }
      };

      const fixupMermaidSvg = (svg: Element) => {
        // replace mermaid id with a consistent one.
        const { baseName: newId } = handlerContext.uniqueFigureName(
          "mermaid-figure-",
          "",
        );
        fixupRevealAlignment(svg);
        const oldId = svg.getAttribute("id") as string;
        svg.setAttribute("id", newId);
        const style = svg.querySelector("style")!;
        style.innerHTML = style.innerHTML.replaceAll(oldId, newId);
      };

      if (
        responsive && options[kFigWidth] === undefined &&
        options[kFigHeight] === undefined
      ) {
        svg = await makeResponsive(svg, fixupMermaidSvg);
      } else {
        svg = await setSvgSize(svg, options, (svg: Element) => {
          // mermaid comes with too much styling wrt to max width. remove it.
          svg.removeAttribute("style");

          fixupMermaidSvg(svg);
        });
      }

      if (isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])) {
        const { sourceName, fullName } = handlerContext
          .uniqueFigureName(
            "mermaid-figure-",
            ".svg",
          );
        Deno.writeTextFileSync(fullName, svg.value);

        const {
          widthInInches,
          heightInInches,
        } = await resolveSize(svg.value, options);

        return asMappedString(
          makeFigLink(sourceName, widthInInches, heightInInches, true),
        );
      } else {
        return this.build(
          handlerContext,
          cell,
          svg,
          options,
          undefined,
          new Set(["fig-width", "fig-height"]),
        );
      }
    };

    const makePng = async () => {
      const {
        filenames: [sourceName],
        elements: [svgText],
      } = await handlerContext.createPngsFromHtml({
        prefix: "mermaid-figure-",
        selector,
        count: 1,
        deviceScaleFactor: Number(options.deviceScaleFactor) || 4,
        html: content,
        resources,
      });

      const {
        widthInInches,
        heightInInches,
      } = await resolveSize(svgText, options);

      if (isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])) {
        return asMappedString(makeFigLink(
          sourceName,
          widthInInches,
          heightInInches,
          true,
        ));
      } else {
        return this.build(
          handlerContext,
          cell,
          asMappedString(makeFigLink(
            sourceName,
            widthInInches,
            heightInInches,
          )),
          options,
          undefined,
          new Set(["fig-width", "fig-height"]),
        );
      }
    };

    // deno-lint-ignore require-await
    const makeJs = async () => {
      setupMermaidJsRuntime();
      const preEl = pandocHtmlBlock("pre")({
        classes: ["mermaid"],
      });
      preEl.push(pandocRawStr(cell.source));

      return this.build(handlerContext, cell, preEl.mappedString(), options);
    };

    const makeDefault = async () => {
      if (isJavascriptCompatible(handlerContext.options.format)) {
        return await makeJs();
      } else if (
        isMarkdownOutput(handlerContext.options.format.pandoc, ["gfm"])
      ) {
        return mappedConcat(["\n``` mermaid\n", cellContent, "\n```\n"]);
      } else {
        return await makePng();
      }
    };

    const format = options[kMermaidFormat] ||
      handlerContext.options.format.execute[kMermaidFormat];

    if (format === "svg") {
      return await makeSvg();
    } else if (format === "png") {
      return await makePng();
    } else if (format === "js") {
      return await makeJs();
    } else {
      return await makeDefault();
    }
  },
};

install(mermaidHandler);
