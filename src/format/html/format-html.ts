// noinspection TypeScriptUnresolvedReference

/*
 * format-html.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */
import { join } from "../../deno_ral/path.ts";
import { warning } from "../../deno_ral/log.ts";

import * as ld from "../../core/lodash.ts";

import { Document, Element } from "../../core/deno-dom.ts";

import { renderEjs } from "../../core/ejs.ts";
import { mergeConfigs } from "../../core/config.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { TempContext } from "../../core/temp.ts";
import { asCssSize } from "../../core/css.ts";

import {
  kBodyClasses,
  kCodeLink,
  kFigResponsive,
  kFilterParams,
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

import {
  formatHasCodeTools,
  kEmbeddedSourceModalId,
} from "../../command/render/codetools.ts";

import { createHtmlFormat } from "./../formats-shared.ts";

import {
  darkModeDefault,
  formatDarkMode,
  formatHasBootstrap,
} from "./format-html-info.ts";

import { bootstrapExtras } from "./format-html-bootstrap.ts";

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
  kXrefsHover,
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
  buildGiscusThemeKeys,
  getDiscussionCategoryId,
  getGithubDiscussionsMetadata,
  GiscusTheme,
  GiscusThemeToggleRecord,
} from "../../core/giscus.ts";
import { metadataPostProcessor } from "./format-html-meta.ts";
import { kHtmlEmptyPostProcessResult } from "../../command/render/constants.ts";
import { kNotebookViewStyleNotebook } from "./format-html-constants.ts";
import { notebookViewPostProcessor } from "./format-html-notebook.ts";
import { ProjectContext } from "../../project/types.ts";
import { kListing } from "../../project/types/website/listing/website-listing-shared.ts";
import {
  HtmlFormatFeatureDefaults,
  HtmlFormatScssOptions,
  HtmlFormatTippyOptions,
} from "./format-html-types.ts";
import { kQuartoHtmlDependency } from "./format-html-constants.ts";
import { registerWriterFormatHandler } from "../format-handlers.ts";

export function htmlFormat(
  figwidth: number,
  figheight: number,
): Format {
  return mergeConfigs(
    createHtmlFormat("HTML", figwidth, figheight),
    {
      render: {
        [kNotebookLinks]: true,
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
        quiet?: boolean,
      ) => {
        // Warn the user if they are using a listing outside of a website
        if (!project && format.metadata[kListing]) {
          warning(
            `Quarto only supports listings within websites. Please ensure that the file ${input} is a part of a website project to enable listing rendering.`,
          );
        }

        const htmlFilterParams = htmlFormatFilterParams(format);
        return mergeConfigs(
          await htmlFormatExtras(
            input,
            flags,
            offset,
            format,
            services.temp,
            project,
          ),
          themeFormatExtras(
            input,
            flags,
            format,
            services,
            offset,
            project,
            quiet,
          ),
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

export async function htmlFormatExtras(
  input: string,
  _flags: PandocFlags,
  offset: string,
  format: Format,
  temp: TempContext,
  _project?: ProjectContext,
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

  // Books don't currently support hover xrefs (since the content to preview in the xref
  // is likely to be on another page and we don't want to do a full fetch of that page
  // to get the preview)
  if (featureDefaults.hoverXrefs) {
    options.hoverXrefs = format.metadata[kXrefsHover] !== false;
  } else {
    options.hoverXrefs = format.metadata[kXrefsHover] || false;
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
    options.codeAnnotations || options.hoverXrefs;
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
  const minimal = format.metadata[kMinimal] === true;
  if (!bootstrap && !minimal) {
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
    giscus.theme = giscus.theme || "";

    const themeToggleRecord: GiscusThemeToggleRecord = buildGiscusThemeKeys(
      Boolean(options.darkModeDefault),
      giscus.theme as GiscusTheme,
    );

    giscus.baseTheme = themeToggleRecord.baseTheme;
    giscus.altTheme = themeToggleRecord.altTheme;
    giscus.theme = giscus.baseTheme;

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
    "styles.html",
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
    hoverXrefs: !minimal,
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
    // Add body class, if present
    if (format.render[kBodyClasses]) {
      const clz = format.render[kBodyClasses].split(" ");
      clz.forEach((cls) => {
        doc.body.classList.add(cls);
      });
    }

    // process all of the code blocks
    const codeBlocks = doc.querySelectorAll("pre.sourceCode");
    const EmbedSourceModal = doc.querySelector(
      `#${kEmbeddedSourceModalId}`,
    );
    for (let i = 0; i < codeBlocks.length; i++) {
      const code = codeBlocks[i] as Element;

      // hoist hidden and cell-code to parent div
      const parentHoist = (clz: string) => {
        if (code.classList.contains(clz)) {
          code.classList.remove(clz);
          code.parentElement?.classList.add(clz);
        }
      };
      parentHoist("cell-code");
      parentHoist("hidden");

      // hoist hidden to parent div
      if (code.classList.contains("hidden")) {
        code.classList.remove("hidden");
        code.parentElement?.classList.add("hidden");
      }

      // insert code copy button (with specfic attribute when inside a modal)
      if (codeCopy) {
        code.classList.add("code-with-copy");
        const copyButton = createCodeCopyButton(doc, format);
        if (EmbedSourceModal && EmbedSourceModal.contains(code)) {
          copyButton.setAttribute("data-in-quarto-modal", "");
        }
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

    // Process tables to restore th-vs-td markers
    const tables = doc.querySelectorAll(
      'table[data-quarto-postprocess-tables="true"]',
    );

    for (let i = 0; i < tables.length; ++i) {
      const table = tables[i] as Element;
      if (table.getAttribute("data-quarto-disable-processing")) {
        continue;
      }
      table.removeAttribute("data-quarto-postprocess-tables");
      table.querySelectorAll("tr").forEach((tr) => {
        const { children } = tr as Element;
        for (let j = 0; j < children.length; ++j) {
          const child = children[j] as Element;
          if (child.tagName === "TH" || child.tagName === "TD") {
            const isTH =
              child.getAttribute("data-quarto-table-cell-role") === "th";
            // create a new element with the correct tag and move all children and attributes to
            // new element
            const newElement = doc.createElement(isTH ? "th" : "td");
            while (child.firstChild) {
              newElement.appendChild(child.firstChild);
            }
            for (let k = 0; k < child.attributes.length; ++k) {
              const attr = child.attributes[k];
              newElement.setAttribute(attr.name, attr.value);
            }

            // replace the old element with the new one
            child.parentNode?.replaceChild(newElement, child);
          }
        }
      });
    }

    // Process drafts, if needed
    const metadraftEl = doc.querySelector("meta[name='quarto:status']");
    if (metadraftEl !== null) {
      const status = metadraftEl.getAttribute("content");
      if (status === "draft") {
        const draftDivEl = doc.createElement("DIV");

        const iconEl = doc.createElement("I");
        iconEl.classList.add("bi");
        iconEl.classList.add("bi-pencil-square");
        const textNode = doc.createTextNode(format.language.draft || "Draft");

        draftDivEl.appendChild(iconEl);
        draftDivEl.appendChild(textNode);
        draftDivEl.setAttribute("id", "quarto-draft-alert");
        draftDivEl.classList.add("alert");
        draftDivEl.classList.add("alert-warning");

        // Find the header and place it there
        let targetEl = doc.body;
        const headerEl = doc.getElementById("quarto-header");
        if (headerEl !== null) {
          targetEl = headerEl;
        }
        targetEl.insertBefore(draftDivEl, targetEl.firstChild);
      }
    }

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

const kCodeAnnotationParentClz = "code-annotated";
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
    if (codeParentEl.parentElement) {
      // Decorate the pre so that we can adjust styles if needed
      codeParentEl.parentElement.classList.add(kCodeAnnotationParentClz);
    }

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
  offset: string | undefined,
  project: ProjectContext,
  quiet?: boolean,
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
    return bootstrapExtras(
      input,
      flags,
      format,
      sevices,
      offset,
      project,
      quiet,
    );
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

registerWriterFormatHandler((format) => {
  switch (format) {
    case "html":
    case "html4":
    case "html5":
      return {
        format: htmlFormat(7, 5),
      };
  }
});
