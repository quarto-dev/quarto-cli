/*
 * mermaid.ts
 *
 * Copyright (C) 2022 Posit Software, PBC
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
  isIpynbOutput,
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
  kMermaidFormat,
} from "../../config/constants.ts";
import { Element } from "../deno-dom.ts";
import { convertFromYaml } from "../lib/yaml-schema/from-yaml.ts";
import { readYamlFromString } from "../yaml.ts";
import { pandocHtmlBlock, pandocRawStr } from "../pandoc/codegen.ts";
import { LocalizedError } from "../lib/located-error.ts";
import { warning } from "log/mod.ts";
import { FormatDependency } from "../../config/types.ts";
import { mappedDiff } from "../mapped-text.ts";
import { escape } from "../../core/lodash.ts";

const mermaidHandler: LanguageHandler = {
  ...baseHandler,

  schema() {
    return Promise.resolve(convertFromYaml(readYamlFromString(`
object:
  properties:
    mermaid-format:
      enum: [png, svg, js]
    theme:
      anyOf:
        - null
        - string
`)));
  },

  type: "cell",
  stage: "post-engine",

  languageName: "mermaid",
  languageClass: (options: LanguageCellHandlerOptions) => {
    if (isMarkdownOutput(options.format, ["gfm"])) {
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
    cell: QuartoMdCell, // this has unmerged cell options
    options: Record<string, unknown>, // this merges default and cell options, we have to be careful.
  ) {
    const mermaidOpts: Record<string, string> = {};
    if (
      typeof handlerContext.options.format.metadata.mermaid === "object" &&
      handlerContext.options.format.metadata.mermaid
    ) {
      const { mermaid } = handlerContext.options.format.metadata as {
        mermaid: Record<string, string>;
      };
      if (mermaid.theme) {
        mermaidOpts.theme = mermaid.theme;
      } else {
        mermaidOpts.theme = "neutral";
      }
    }

    const cellContent = handlerContext.cellContent(cell);
    // TODO escaping removes MappedString information.
    // create puppeteer target page
    const content = `<html>
<head>
<script src="./mermaid.min.js"></script>
</head>
<body>
<pre class="mermaid">\n${escape(cellContent.value)}\n</pre> 
<script>
mermaid.initialize(${JSON.stringify(mermaidOpts)});
</script>
</html>`;
    const selector = "pre.mermaid svg";
    const resources: [string, string][] = [[
      "mermaid.min.js",
      Deno.readTextFileSync(
        formatResourcePath("html", join("mermaid", "mermaid.min.js")),
      ),
    ]];

    const setupMermaidSvgJsRuntime = () => {
      if (handlerContext.getState().hasSetupMermaidSvgJsRuntime) {
        return;
      }
      handlerContext.getState().hasSetupMermaidSvgJsRuntime = true;

      const dep: FormatDependency = {
        name: "quarto-diagram",
        scripts: [
          {
            name: "mermaid-postprocess-shim.js",
            path: formatResourcePath(
              "html",
              join("mermaid", "mermaid-postprocess-shim.js"),
            ),
            afterBody: true,
          },
        ],
      };
      handlerContext.addHtmlDependency(dep);
    };

    const setupMermaidJsRuntime = () => {
      if (handlerContext.getState().hasSetupMermaidJsRuntime) {
        return;
      }
      handlerContext.getState().hasSetupMermaidJsRuntime = true;

      const jsName =
        handlerContext.options.context.format.metadata?.["mermaid-debug"]
          ? "mermaid.js"
          : "mermaid.min.js";

      if (mermaidOpts.theme) {
        const mermaidMeta: Record<string, string> = {};
        mermaidMeta["mermaid-theme"] = mermaidOpts.theme;
        handlerContext.addHtmlDependency({
          name: "quarto-mermaid-conf",
          meta: mermaidMeta,
        });
      }

      const dep: FormatDependency = {
        name: "quarto-diagram",
        scripts: [
          {
            name: jsName,
            path: formatResourcePath("html", join("mermaid", jsName)),
          },
          {
            name: "mermaid-init.js",
            path: formatResourcePath(
              "html",
              join("mermaid", "mermaid-init.js"),
            ),
            afterBody: true,
          },
        ],
        stylesheets: [
          {
            name: "mermaid.css",
            path: formatResourcePath("html", join("mermaid", "mermaid.css")),
          },
        ],
      };
      handlerContext.addHtmlDependency(dep);
    };

    const makeFigLink = (
      sourceName: string,
      width?: number,
      height?: number,
      includeCaption?: boolean,
    ) => {
      const figEnvSpecifier =
        isLatexOutput(handlerContext.options.format.pandoc)
          ? ` fig-env='${cell.options?.["fig-env"] || "figure"}'`
          : "";
      let posSpecifier = "";
      if (
        isLatexOutput(handlerContext.options.format.pandoc) &&
        cell.options?.["fig-pos"] !== false
      ) {
        const v = Array.isArray(cell.options?.["fig-pos"])
          ? cell.options?.["fig-pos"].join("")
          : cell.options?.["fig-pos"];
        posSpecifier = ` fig-pos='${v || "H"}'`;
      }
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

      return `\n![${captionSpecifier}](${sourceName}){${widthSpecifier}${heightSpecifier}${posSpecifier}${figEnvSpecifier}${idSpecifier}}\n`;
    };
    const responsive = handlerContext.options.context.format.metadata
      ?.[kFigResponsive];

    const makeSvg = async () => {
      setupMermaidSvgJsRuntime();
      let svg = asMappedString(
        (await handlerContext.extractHtml({
          html: content,
          selector,
          resources,
        }))[0],
      );

      const fixupRevealAlignment = (svg: Element) => {
        if (isRevealjsOutput(handlerContext.options.context.format.pandoc)) {
          const align = (options?.[kFigAlign] as string) ?? "center";
          fixupAlignment(svg, align);
        }
      };

      let newId: string | undefined = undefined;
      const idsToPatch: string[] = [];

      const fixupMermaidSvg = (svg: Element) => {
        // replace mermaid id with a consistent one.
        const { baseName: newMermaidId } = handlerContext.uniqueFigureName(
          "mermaid-figure-",
          "",
        );
        newId = newMermaidId;
        fixupRevealAlignment(svg);
        const oldId = svg.getAttribute("id") as string;
        svg.setAttribute("id", newMermaidId);
        const style = svg.querySelector("style")!;
        style.innerHTML = style.innerHTML.replaceAll(oldId, newMermaidId);

        for (const defNode of svg.querySelectorAll("defs")) {
          const defEl = defNode as Element;
          // because this is a defs node and deno-dom doesn't like non-html elements,
          // we can't use the standard API
          const m = defEl.innerHTML.match(/id="([^\"]+)"/);
          if (m) {
            const id = m[1];
            idsToPatch.push(id);
          }
        }
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

      // This is a preposterously ugly fix to a mermaid issue where
      // duplicate definition ids are emitted, which causes diagrams to step
      // on one another's toes.
      if (idsToPatch.length) {
        let oldSvgSrc = svg.value;
        for (const idToPatch of idsToPatch) {
          const to = `${newId}-${idToPatch}`;
          // this string substitution is fraught, but I don't know how else to fix the problem.
          oldSvgSrc = oldSvgSrc.replaceAll(
            `"${idToPatch}"`,
            `"${to}"`,
          );
          oldSvgSrc = oldSvgSrc.replaceAll(
            `#${idToPatch}`,
            `#${to}`,
          );
        }
        svg = mappedDiff(svg, oldSvgSrc);
      }

      if (isMarkdownOutput(handlerContext.options.format, ["gfm"])) {
        const { sourceName, fullName } = handlerContext
          .uniqueFigureName(
            "mermaid-figure-",
            ".svg",
          );
        Deno.writeTextFileSync(fullName, svg.value);

        const {
          widthInInches,
          heightInInches,
        } = await resolveSize(svg.value, cell.options ?? {});

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
          new Set(["fig-width", "fig-height", "mermaid-format"]),
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
      } = await resolveSize(svgText, cell.options ?? {});

      if (isMarkdownOutput(handlerContext.options.format, ["gfm"])) {
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
          new Set(["fig-width", "fig-height", "mermaid-format"]),
        );
      }
    };

    // deno-lint-ignore require-await
    const makeJs = async () => {
      setupMermaidJsRuntime();
      // removed until we use mermaid 10.0.0
      //
      // const { baseName: tooltipName } = handlerContext
      //   .uniqueFigureName(
      //     "mermaid-tooltip-",
      //     "",
      //   );
      const preAttrs = [];
      if (options.label) {
        preAttrs.push(`label="${options.label}"`);
      }
      const preEl = pandocHtmlBlock("pre")({
        classes: ["mermaid", "mermaid-js"],
        attrs: preAttrs,
      });

      const content = handlerContext.cellContent(cell);
      preEl.push(pandocRawStr(escape(content.value))); // TODO escaping removes MappedString information.

      const attrs: Record<string, unknown> = {};
      if (isRevealjsOutput(handlerContext.options.context.format.pandoc)) {
        attrs.reveal = true;
      }

      return this.build(
        handlerContext,
        cell,
        mappedConcat([
          preEl.mappedString(),
          // tooltips appear to be broken in mermaid 9.2.2?
          // They don't even work on their website: https://mermaid-js.github.io/mermaid/#/flowchart
          // we drop them for now.
          // `\n<div id="${tooltipName}" class="mermaidTooltip"></div>`,
        ]),
        options,
        attrs,
        new Set(["mermaid-format"]),
      );
    };

    const makeDefault = async () => {
      if (isIpynbOutput(handlerContext.options.format.pandoc)) {
        return await makePng();
      } else if (isJavascriptCompatible(handlerContext.options.format)) {
        return await makeJs();
      } else if (
        isMarkdownOutput(handlerContext.options.format, ["gfm"])
      ) {
        return mappedConcat([
          "\n``` mermaid\n",
          cellContent,
          "\n```\n",
        ]);
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
      if (!isJavascriptCompatible(handlerContext.options.format)) {
        const error = new LocalizedError(
          "IncompatibleOutput",
          `\`mermaid-format: js\` not supported in format ${
            handlerContext.options.format.pandoc.to ?? ""
          }`,
          cell.sourceVerbatim,
          0,
        );
        warning(error.message);
        console.log("");
        return await makeDefault();
      } else {
        if (isRevealjsOutput(handlerContext.options.context.format.pandoc)) {
          const error = new LocalizedError(
            "NotRecommended",
            `\`mermaid-format: js\` not recommended in format ${
              handlerContext.options.format.pandoc.to ?? ""
            }`,
            cell.sourceVerbatim,
            0,
          );
          warning(error.message);
          console.log("");
        }
        return await makeJs();
      }
    } else {
      return await makeDefault();
    }
  },
};

install(mermaidHandler);
