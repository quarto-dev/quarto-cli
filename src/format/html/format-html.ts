/*
* format-html.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/
import { join } from "path/mod.ts";

import * as ld from "../../core/lodash.ts";

import { Document, Element } from "../../core/deno-dom.ts";

import { renderEjs } from "../../core/ejs.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { TempContext } from "../../core/temp.ts";
import { asCssSize } from "../../core/css.ts";

import {
  kCodeLink,
  kFigResponsive,
  kFilterParams,
  kFormatLinks,
  kHeaderIncludes,
  kIncludeAfterBody,
  kIncludeInHeader,
  kLinkExternalFilter,
  kLinkExternalIcon,
  kLinkExternalNewwindow,
  kNotebookLinks,
  kNotebookViewStyle,
  kTheme,
} from "../../config/constants.ts";

import {
  DependencyHtmlFile,
  Format,
  FormatDependency,
  FormatExtras,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  Metadata,
  PandocFlags,
  SassBundle,
} from "../../config/types.ts";

import { formatHasCodeTools } from "../../command/render/codetools.ts";

import { createHtmlFormat } from "./../formats-shared.ts";

import {
  darkModeDefault,
  formatDarkMode,
  formatHasBootstrap,
} from "./format-html-info.ts";

import { boostrapExtras } from "./format-html-bootstrap.ts";

import {
  clipboardDependency,
  createCodeCopyButton,
  kAnchorSections,
  kBootstrapDependencyName,
  kCitationsHover,
  kCodeAnnotations,
  kCodeCopy,
  kComments,
  kDocumentCss,
  kFootnotesHover,
  kGiscus,
  kGiscusCategoryId,
  kGiscusRepoId,
  kHypothesis,
  kMinimal,
  kSmoothScroll,
  kTabsets,
  kUtterances,
  quartoBaseLayer,
  quartoGlobalCssVariableRules,
} from "./format-html-shared.ts";
import {
  kSiteUrl,
  kWebsite,
} from "../../project/types/website/website-constants.ts";
import {
  HtmlPostProcessResult,
  RenderServices,
} from "../../command/render/types.ts";
import {
  getDiscussionCategoryId,
  getGithubDiscussionsMetadata,
} from "../../core/giscus.ts";
import { metadataPostProcessor } from "./format-html-meta.ts";
import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import {
  kNotebookViewStyleNotebook,
  notebookViewPostProcessor,
} from "./format-html-notebook.ts";
import { ProjectConfig, ProjectContext } from "../../project/types.ts";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    createHtmlFormat("HTML", figwidth, figheight),
    {
      render: {
        [kNotebookLinks]: true,
        [kFormatLinks]: true,
      },
      resolveFormat: (format: Format) => {
        if (format.metadata[kMinimal] === true) {
          if (format.metadata[kFigResponsive] === undefined) {
            format.metadata[kFigResponsive] = false;
          }
          if (format.metadata[kTheme] === undefined) {
            format.metadata[kTheme] = "none";
          }
        }
      },
      formatExtras: async (
        input: string,
        _markdown: string,
        flags: PandocFlags,
        format: Format,
        _libDir: string,
        services: RenderServices,
        offset: string,
        project: ProjectContext,
      ) => {
        const htmlFilterParams = htmlFormatFilterParams(format);
        return mergeConfigs(
          await htmlFormatExtras(input, flags, offset, format, services.temp),
          themeFormatExtras(input, flags, format, services, offset, project),
          { [kFilterParams]: htmlFilterParams },
        );
      },
      extensions: {
        book: {
          multiFile: true,
        },
      },
    },
  );
}

export const kQuartoHtmlDependency = "quarto-html";

export interface HtmlFormatFeatureDefaults {
  tabby?: boolean;
  copyCode?: boolean;
  anchors?: boolean;
  hoverCitations?: boolean;
  hoverFootnotes?: boolean;
  figResponsive?: boolean;
  codeAnnotations?: boolean;
}

export interface HtmlFormatTippyOptions {
  theme?: string;
  parent?: string;
  config?: Metadata;
}

export interface HtmlFormatScssOptions {
  quartoBase?: boolean;
  quartoCssVars?: boolean;
}

export async function htmlFormatExtras(
  input: string,
  _flags: PandocFlags,
  offset: string,
  format: Format,
  temp: TempContext,
  featureDefaults?: HtmlFormatFeatureDefaults,
  tippyOptions?: HtmlFormatTippyOptions,
  scssOptions?: HtmlFormatScssOptions,
): Promise<FormatExtras> {
  // note whether we are targeting bootstrap
  const bootstrap = formatHasBootstrap(format);

  // populate feature defaults if none provided
  if (!featureDefaults) {
    featureDefaults = htmlFormatFeatureDefaults(format);
  }

  // empty tippy options if none provided
  if (!tippyOptions) {
    tippyOptions = {};
  }
  if (!tippyOptions.config) {
    tippyOptions.config = {};
  }
  if (!scssOptions) {
    scssOptions = {};
  }
  if (scssOptions.quartoBase === undefined) {
    scssOptions.quartoBase = true;
  }
  if (scssOptions.quartoCssVars === undefined) {
    scssOptions.quartoCssVars = true;
  }

  // lists of scripts and ejs data for the orchestration script
  const scripts: DependencyHtmlFile[] = [];
  const stylesheets: DependencyHtmlFile[] = [];
  const sassBundles: SassBundle[] = [];
  const dependencies: FormatDependency[] = [];

  const options: Record<string, unknown> =
    ld.isObject(format.metadata[kComments])
      ? {
        [kHypothesis]: (format.metadata[kComments] as Record<string, unknown>)[
          kHypothesis
        ] ||
          false,
        [kUtterances]: (format.metadata[kComments] as Record<string, unknown>)[
          kUtterances
        ] ||
          false,
        [kGiscus]:
          (format.metadata[kComments] as Record<string, unknown>)[kGiscus] ||
          false,
      }
      : {};
  options.codeLink = format.metadata[kCodeLink] || false;

  // apply defaults
  if (featureDefaults.tabby) {
    options.tabby = format.metadata[kTabsets] !== false;
  } else {
    options.tabby = format.metadata[kTabsets] || false;
  }
  if (featureDefaults.copyCode) {
    options.copyCode = format.metadata[kCodeCopy] !== false;
  } else {
    options.copyCode = format.metadata[kCodeCopy] || false;
  }
  if (featureDefaults.anchors) {
    options.anchors = format.metadata[kAnchorSections] !== false;
  } else {
    options.anchors = format.metadata[kAnchorSections] || false;
  }
  if (featureDefaults.hoverCitations) {
    options.hoverCitations = format.metadata[kCitationsHover] !== false;
  } else {
    options.hoverCitations = format.metadata[kCitationsHover] || false;
  }
  if (featureDefaults.hoverFootnotes) {
    options.hoverFootnotes = format.metadata[kFootnotesHover] !== false;
  } else {
    options.hoverFootnotes = format.metadata[kFootnotesHover] || false;
  }
  if (featureDefaults.figResponsive) {
    options.figResponsive = format.metadata[kFigResponsive] !== false;
  } else {
    options.figResponsive = format.metadata[kFigResponsive] || false;
  }
  if (featureDefaults.codeAnnotations) {
    options.codeAnnotations = format.metadata[kCodeAnnotations] || true;
  } else {
    options.codeAnnotations = format.metadata[kCodeAnnotations] || false;
  }

  options.zenscroll = format.metadata[kSmoothScroll];
  options.codeTools = formatHasCodeTools(format);
  options.darkMode = formatDarkMode(format);
  options.darkModeDefault = darkModeDefault(format.metadata);
  options.linkExternalIcon = format.render[kLinkExternalIcon];
  options.linkExternalNewwindow = format.render[kLinkExternalNewwindow];
  options.linkExternalFilter = format.render[kLinkExternalFilter];

  // If there is a site URL, we can use that as the default filter
  const siteMetadata = format.metadata[kWebsite] as Metadata;
  if (!options.linkExternalFilter && siteMetadata) {
    const siteUrl = siteMetadata[kSiteUrl] as string;
    if (siteUrl) {
      options.linkExternalFilter = siteUrl.replaceAll(".", "\\.").replaceAll(
        "/",
        "\\/",
      );
    }
  }

  // quarto.js helpers
  if (bootstrap) {
    scripts.push({
      name: "quarto.js",
      path: formatResourcePath("html", "quarto.js"),
    });
  }

  // tabby if required
  if (options.tabby) {
    scripts.push({
      name: "tabby.min.js",
      path: formatResourcePath("html", join("tabby", "js", "tabby.js")),
    });
  }

  // header includes
  const includeInHeader: string[] = [];

  // zenscroll if required
  if (options.zenscroll) {
    scripts.push({
      name: "zenscroll-min.js",
      path: formatResourcePath("html", join("zenscroll", "zenscroll-min.js")),
      afterBody: true,
    });

    const zenscrollStyle = temp.createFile({ suffix: "-zen.html" });
    Deno.writeTextFileSync(
      zenscrollStyle,
      "<style>html{ scroll-behavior: smooth; }</style>",
    );
    includeInHeader.push(zenscrollStyle);
  }

  // popper if required
  options.tippy = options.hoverCitations || options.hoverFootnotes ||
    options.codeAnnotations;
  if (bootstrap || options.tippy) {
    scripts.push({
      name: "popper.min.js",
      path: formatResourcePath("html", join("popper", "popper.min.js")),
    });
  }

  // tippy if required
  if (options.tippy) {
    scripts.push({
      name: "tippy.umd.min.js",
      path: formatResourcePath("html", join("tippy", "tippy.umd.min.js")),
    });
    stylesheets.push({
      name: "tippy.css",
      path: formatResourcePath("html", join("tippy", "tippy.css")),
    });

    // If this is a bootstrap format, include requires sass
    if (tippyOptions.theme === undefined) {
      if (bootstrap) {
        tippyOptions.theme = "quarto";
        sassBundles.push({
          key: "tippy.scss",
          dependency: kBootstrapDependencyName,
          quarto: {
            uses: "",
            functions: "",
            defaults: "",
            mixins: "",
            rules: Deno.readTextFileSync(
              formatResourcePath("html", join("tippy", "_tippy.scss")),
            ),
          },
        });
      } else {
        tippyOptions.theme = "light-border";
        stylesheets.push({
          name: "light-border.css",
          path: formatResourcePath("html", join("tippy", "light-border.css")),
        });
      }
    }
  }

  // propagate tippyOptions
  options.tippyOptions = tippyOptions;

  // clipboard.js if required
  if (options.copyCode) {
    dependencies.push(clipboardDependency());
  }

  // Add localization strings
  options.language = format.language;

  // anchors if required
  if (options.anchors) {
    scripts.push({
      name: "anchor.min.js",
      path: formatResourcePath("html", join("anchor", "anchor.min.js")),
    });
    options.anchors = typeof (options.anchors) === "string"
      ? options.anchors
      : true;
  }

  // add quarto sass bundle of we aren't in bootstrap
  if (!bootstrap) {
    if (scssOptions.quartoBase) {
      sassBundles.push({
        dependency: kQuartoHtmlDependency,
        key: kQuartoHtmlDependency,
        quarto: quartoBaseLayer(
          format,
          !!options.copyCode,
          !!options.tabby,
          !!options.figResponsive,
        ),
      });
    }
    if (scssOptions.quartoCssVars) {
      sassBundles.push({
        dependency: kQuartoHtmlDependency,
        key: kQuartoHtmlDependency,
        quarto: {
          uses: "",
          defaults: "",
          functions: "",
          mixins: "",
          rules: quartoGlobalCssVariableRules(),
        },
      });
    }
  }

  // hypothesis
  if (options.hypothesis) {
    const hypothesisHeader = temp.createFile({ suffix: "-hypoth.html" });
    Deno.writeTextFileSync(
      hypothesisHeader,
      renderEjs(
        formatResourcePath("html", join("hypothesis", "hypothesis.ejs")),
        { hypothesis: options.hypothesis },
      ),
    );
    includeInHeader.push(hypothesisHeader);
  }

  // after body
  const includeAfterBody: string[] = [];

  // add main orchestion script if we have any options enabled
  const quartoHtmlRequired = Object.keys(options).some((option) =>
    !!options[option]
  );
  if (quartoHtmlRequired) {
    // html orchestration script
    const quartoHtmlScript = temp.createFile();
    const renderedHtml = renderEjs(
      formatResourcePath("html", join("templates", "quarto-html.ejs")),
      options,
    );
    if (renderedHtml.trim() !== "") {
      Deno.writeTextFileSync(quartoHtmlScript, renderedHtml);
      includeAfterBody.push(quartoHtmlScript);
    }
  }

  // utterances
  if (options.utterances) {
    if (typeof (options.utterances) !== "object") {
      throw new Error("Invalid utterances configuration (must provide a repo");
    }
    const utterances = options.utterances as Record<string, string>;
    if (!utterances["repo"]) {
      throw new Error("Invalid utterances coniguration (must provide a repo)");
    }
    utterances["issue-term"] = utterances["issue-term"] || "pathname";
    utterances["theme"] = utterances["theme"] || "github-light";
    const utterancesAfterBody = temp.createFile({ suffix: "-utter.html" });
    Deno.writeTextFileSync(
      utterancesAfterBody,
      renderEjs(
        formatResourcePath("html", join("utterances", "utterances.ejs")),
        { utterances },
      ),
    );
    includeAfterBody.push(utterancesAfterBody);
  }

  // giscus
  if (options.giscus) {
    const giscus = options.giscus as Record<string, unknown>;
    giscus.category = giscus.category || "General";
    giscus.theme = giscus.theme || "light";
    giscus.mapping = giscus.mapping || "title";
    giscus["reactions-enabled"] = giscus["reactions-enabled"] !== undefined
      ? giscus["reactions-enabled"]
      : true;
    giscus["input-position"] = giscus["input-position"] || "top";
    giscus.language = giscus.language || "en";

    if (
      giscus[kGiscusRepoId] === undefined ||
      giscus[kGiscusCategoryId] === undefined
    ) {
      const discussionData = await getGithubDiscussionsMetadata(
        giscus.repo as string,
      );

      // Fetch repo info
      if (giscus[kGiscusRepoId] === undefined && discussionData.repositoryId) {
        giscus[kGiscusRepoId] = discussionData.repositoryId;
      }

      const categoryId = getDiscussionCategoryId(
        giscus.category as string,
        discussionData,
      );
      if (giscus[kGiscusCategoryId] === undefined && categoryId) {
        giscus[kGiscusCategoryId] = categoryId;
      }
    }

    const giscusAfterBody = temp.createFile({ suffix: "-giscus.html" });
    Deno.writeTextFileSync(
      giscusAfterBody,
      renderEjs(
        formatResourcePath("html", join("giscus", "giscus.ejs")),
        { giscus },
      ),
    );
    includeAfterBody.push(giscusAfterBody);
  }

  // return extras
  dependencies.push({
    name: kQuartoHtmlDependency,
    scripts,
    stylesheets,
  });

  // Provide a template and partials
  const templateDir = formatResourcePath("html", "pandoc");
  const partials = [
    "metadata.html",
    "title-block.html",
    "toc.html",
  ];
  const templateContext = {
    template: join(templateDir, "template.html"),
    partials: partials.map((partial) => join(templateDir, partial)),
  };

  const htmlPostProcessors = [
    htmlFormatPostprocessor(format, featureDefaults),
    metadataPostProcessor(input, format, offset),
  ];
  const viewStyle = format.render[kNotebookViewStyle];
  if (viewStyle === kNotebookViewStyleNotebook) {
    htmlPostProcessors.push(notebookViewPostProcessor());
  }

  const metadata: Metadata = {};
  return {
    [kIncludeInHeader]: includeInHeader,
    [kIncludeAfterBody]: includeAfterBody,
    metadata,
    templateContext,
    html: {
      [kDependencies]: dependencies,
      [kSassBundles]: sassBundles,
      [kHtmlPostprocessors]: htmlPostProcessors,
    },
  };
}

const kFormatHasBootstrap = "has-bootstrap";
function htmlFormatFilterParams(format: Format) {
  return {
    [kFormatHasBootstrap]: formatHasBootstrap(format),
  };
}

function htmlFormatFeatureDefaults(
  format: Format,
): HtmlFormatFeatureDefaults {
  const bootstrap = formatHasBootstrap(format);
  const minimal = format.metadata[kMinimal] === true;
  return {
    tabby: !minimal && !bootstrap,
    copyCode: !minimal,
    anchors: !minimal,
    hoverCitations: !minimal,
    hoverFootnotes: !minimal,
    figResponsive: !minimal,
    codeAnnotations: !minimal,
  };
}

function htmlFormatPostprocessor(
  format: Format,
  featureDefaults?: HtmlFormatFeatureDefaults,
) {
  // do we have haveBootstrap
  const haveBootstrap = formatHasBootstrap(format);

  // get feature defaults
  if (!featureDefaults) {
    featureDefaults = htmlFormatFeatureDefaults(format);
  }

  // read options
  const codeCopy = featureDefaults.copyCode
    ? format.metadata[kCodeCopy] !== false
    : format.metadata[kCodeCopy] || false;

  const anchors = featureDefaults.anchors
    ? format.metadata[kAnchorSections] !== false
    : format.metadata[kAnchorSections] || false;

  return (doc: Document): Promise<HtmlPostProcessResult> => {
    // process all of the code blocks
    const codeBlocks = doc.querySelectorAll("pre.sourceCode");
    for (let i = 0; i < codeBlocks.length; i++) {
      const code = codeBlocks[i] as Element;

      // hoist hidden and cell-code to parent div
      const parentHoist = (clz: string) => {
        if (code.classList.contains(clz)) {
          code.classList.delete(clz);
          code.parentElement?.classList.add(clz);
        }
      };
      parentHoist("cell-code");
      parentHoist("hidden");

      // hoist hidden to parent div
      if (code.classList.contains("hidden")) {
        code.classList.delete("hidden");
        code.parentElement?.classList.add("hidden");
      }

      // insert code copy button
      if (codeCopy) {
        code.classList.add("code-with-copy");
        const copyButton = createCodeCopyButton(doc, format);
        code.appendChild(copyButton);
      }

      // insert example iframe
      if (code.parentElement?.getAttribute("data-code-preview")) {
        const codeExample = doc.createElement("iframe");
        for (const parentClass of code.classList) {
          codeExample.classList.add(parentClass);
        }
        codeExample.setAttribute(
          "src",
          code.parentElement.getAttribute("data-code-preview")!.replace(
            /\.qmd$/,
            ".html",
          ),
        );
        code.parentElement.removeAttribute(
          "data-code-preview",
        );
        code.parentElement.appendChild(codeExample);
      }
    }

    // add .anchored class to headings
    if (anchors) {
      const container = haveBootstrap
        ? doc.querySelector("main")
        : doc.querySelector("body");

      if (container) {
        ["h2", "h3", "h4", "h5", "h6", ".quarto-figure[id]", "div[id^=tbl-]"]
          .forEach(
            (selector) => {
              const headings = container.querySelectorAll(selector);
              for (let i = 0; i < headings.length; i++) {
                const heading = headings[i] as Element;
                if (heading.id !== "toc-title") {
                  if (!heading.classList.contains("no-anchor")) {
                    heading.classList.add("anchored");
                  }
                }
              }
            },
          );
      }
    }

    // remove toc-section-number if we have provided our own section numbers
    const headerSections = doc.querySelectorAll(".header-section-number");
    for (let i = 0; i < headerSections.length; i++) {
      const secNumber = headerSections[i] as Element;
      const prevElement = secNumber.previousElementSibling;
      if (prevElement && prevElement.classList.contains("toc-section-number")) {
        secNumber.remove();
      }
    }

    // Process code annotations that may appear in this document
    processCodeAnnotations(format, doc);

    // no resource refs
    return Promise.resolve(kHtmlEmptyPostProcessResult);
  };
}

const kCodeCellAttr = "data-code-cell";
const kCodeLinesAttr = "data-code-lines";
const kCodeAnnotationAttr = "data-code-annotation";

const kCodeCellTargetAttr = "data-target-cell";
const kCodeAnnotationTargetAttr = "data-target-annotation";

const kCodeAnnotationHiddenClz = "code-annotation-container-hidden";
const kCodeAnnotationGridClz = "code-annotation-container-grid";
const kCodeAnnotationAnchorClz = "code-annotation-anchor";
const kCodeAnnotationTargetClz = "code-annotation-target";

const kCodeAnnotationGutterClz = "code-annotation-gutter";
const kCodeAnnotationGutterBgClz = "code-annotation-gutter-bg";

function processCodeAnnotations(format: Format, doc: Document) {
  const annotationStyle: boolean | string = format.metadata[kCodeAnnotations] as
    | string
    | boolean;

  const replaceLineNumberWithAnnote = (annoteEl: Element, dtEl: Element) => {
    const annotation = annoteEl.getAttribute(kCodeAnnotationAttr);
    if (annotation !== null) {
      const ddEl = dtEl.previousElementSibling;
      if (ddEl) {
        ddEl.innerHTML = "";
        ddEl.innerText = annotation;
        const codeCell = annoteEl.getAttribute(kCodeCellAttr);
        if (codeCell) {
          ddEl.setAttribute(kCodeCellTargetAttr, codeCell);
          ddEl.setAttribute(kCodeAnnotationTargetAttr, annotation);
        }
      }
    }
  };

  if (annotationStyle === false) {
    // Read the definition list values which contain the annotations
    const annoteNodes = doc.querySelectorAll(`span[${kCodeCellAttr}]`);

    // annotations are disabled, just hide the DL container
    for (const annoteNode of annoteNodes) {
      const annoteEl = annoteNode as Element;

      // Mark the parent DL container with a class
      // so CSS can target it
      const parentDL = annoteEl.parentElement?.parentElement;
      if (
        parentDL && !parentDL.classList.contains(kCodeAnnotationHiddenClz)
      ) {
        parentDL.classList.add(kCodeAnnotationHiddenClz);
      }
    }
  } else if (annotationStyle === "hover" || annotationStyle === "select") {
    const definitionLists = processCodeBlockAnnotation(
      doc,
      true,
      "start",
      replaceLineNumberWithAnnote,
    );

    Object.values(definitionLists).forEach((dl) => {
      dl.classList.add(kCodeAnnotationHiddenClz);
      dl.classList.add(kCodeAnnotationGridClz);
    });
  } else {
    const definitionLists = processCodeBlockAnnotation(
      doc,
      false,
      "start",
      replaceLineNumberWithAnnote,
    );

    Object.values(definitionLists).forEach((dl) => {
      dl.classList.add(kCodeAnnotationGridClz);
    });
  }
}

// returns DLs that were processed

function processCodeBlockAnnotation(
  doc: Document,
  interactiveAnnotations: boolean,
  annotationPosition: "start" | "middle",
  processDt?: (annotationEl: Element, dtEl: Element) => void,
) {
  const definitionLists: Record<string, Element> = {};
  const codeBlockParents: Element[] = [];

  // Read the definition list values which contain the annotations
  const annoteNodes = doc.querySelectorAll(`span[${kCodeCellAttr}]`);
  for (const annoteNode of annoteNodes) {
    const annoteEl = annoteNode as Element;

    // Accumulate the Code Blocks
    const parentCodeBlock = processLineAnnotation(
      doc,
      annoteEl,
      interactiveAnnotations,
      annotationPosition,
    );
    if (parentCodeBlock && !codeBlockParents.includes(parentCodeBlock)) {
      codeBlockParents.push(parentCodeBlock);
    }

    // Accumulate the Definition Lists
    const parentDL = annoteEl.parentElement?.parentElement;
    const codeParentDivId = parentCodeBlock?.parentElement?.parentElement?.id;
    if (
      parentDL && codeParentDivId &&
      !Object.keys(definitionLists).includes(codeParentDivId)
    ) {
      definitionLists[codeParentDivId] = parentDL;
    }

    if (annoteEl.parentElement && processDt) {
      processDt(annoteEl, annoteEl.parentElement);
    }
  }

  // Inject a gutter for the annotations
  for (const codeParentEl of codeBlockParents) {
    const gutterBgDivEl = doc.createElement("div");
    gutterBgDivEl.classList.add(kCodeAnnotationGutterBgClz);
    codeParentEl?.appendChild(gutterBgDivEl);

    const gutterDivEl = doc.createElement("div");
    gutterDivEl.classList.add(kCodeAnnotationGutterClz);
    codeParentEl?.appendChild(gutterDivEl);
  }

  return definitionLists;
}

function processLineAnnotation(
  doc: Document,
  annoteEl: Element,
  interactive: boolean,
  position: "start" | "middle",
) {
  // Read the target values from the annotation DL
  const targetCell = annoteEl.getAttribute(kCodeCellAttr);
  const targetLines = annoteEl.getAttribute(kCodeLinesAttr);
  const targetAnnotation = annoteEl.getAttribute(kCodeAnnotationAttr);
  if (targetCell && targetLines) {
    const lineArr = targetLines?.split(",");

    const targetIndex = position === "start"
      ? 0
      : Math.floor(lineArr.length / 2);
    const line = lineArr[targetIndex];

    const targetId = `${targetCell}-${line}`;
    const targetEl = doc.getElementById(targetId);
    if (targetEl) {
      const annoteAnchorEl = doc.createElement(interactive ? "button" : "a");
      annoteAnchorEl.classList.add(kCodeAnnotationAnchorClz);
      annoteAnchorEl.setAttribute(
        kCodeCellTargetAttr,
        `${targetCell}`,
      );
      annoteAnchorEl.setAttribute(
        kCodeAnnotationTargetAttr,
        `${targetAnnotation}`,
      );
      if (!interactive) {
        annoteAnchorEl.setAttribute("onclick", "event.preventDefault();");
      }
      annoteAnchorEl.innerText = targetAnnotation || "?";
      targetEl.parentElement?.insertBefore(annoteAnchorEl, targetEl);
      targetEl.classList.add(kCodeAnnotationTargetClz);
      return targetEl.parentElement;
    }
  }
}

function themeFormatExtras(
  input: string,
  flags: PandocFlags,
  format: Format,
  sevices: RenderServices,
  offset?: string,
  project?: ProjectContext,
) {
  const theme = format.metadata[kTheme];
  if (theme === "none") {
    return {
      metadata: {
        [kDocumentCss]: false,
      },
    };
  } else if (theme === "pandoc") {
    return pandocExtras(format);
  } else {
    return boostrapExtras(input, flags, format, sevices, offset, project);
  }
}

function pandocExtras(format: Format) {
  // see if there is a max-width
  const maxWidth = format.metadata["max-width"];
  const headerIncludes = maxWidth
    ? `<style type="text/css">body { max-width: ${
      asCssSize(maxWidth)
    };}</style>`
    : undefined;

  return {
    metadata: {
      [kDocumentCss]: true,
      [kHeaderIncludes]: headerIncludes,
    },
  };
}
