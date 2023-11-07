/*
 * pandoc.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { basename, dirname, isAbsolute, join } from "path/mod.ts";

import { info } from "log/mod.ts";

import { existsSync, expandGlobSync } from "fs/mod.ts";

import { stringify } from "yaml/mod.ts";
import { encode as base64Encode } from "encoding/base64.ts";

import * as ld from "../../core/lodash.ts";

import { Document } from "../../core/deno-dom.ts";

import { execProcess } from "../../core/process.ts";
import { dirAndStem, normalizePath } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";

import {
  Format,
  FormatExtras,
  FormatPandoc,
  kBodyEnvelope,
  kDependencies,
  kHtmlFinalizers,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  kTextHighlightingMode,
} from "../../config/types.ts";
import {
  isAstOutput,
  isBeamerOutput,
  isEpubOutput,
  isHtmlDocOutput,
  isHtmlFileOutput,
  isHtmlOutput,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isTypstOutput,
} from "../../config/format.ts";
import {
  isIncludeMetadata,
  isQuartoMetadata,
  metadataGetDeep,
} from "../../config/metadata.ts";
import { pandocBinaryPath, resourcePath } from "../../core/resources.ts";
import { pandocAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";
import {
  partitionYamlFrontMatter,
  readYamlFromMarkdown,
} from "../../core/yaml.ts";

import { ProjectContext } from "../../project/types.ts";

import {
  deleteProjectMetadata,
  projectIsBook,
  projectIsWebsite,
} from "../../project/project-shared.ts";
import { deleteCrossrefMetadata } from "../../project/project-crossrefs.ts";

import {
  getPandocArg,
  havePandocArg,
  kQuartoForwardedMetadataFields,
  removePandocArgs,
} from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { filterParamsJson, removeFilterParams } from "./filters.ts";
import {
  kAbstract,
  kAbstractTitle,
  kAuthor,
  kAuthors,
  kClassOption,
  kColorLinks,
  kColumns,
  kDate,
  kDateFormat,
  kDateModified,
  kDocumentClass,
  kEmbedResources,
  kFigResponsive,
  kFilterParams,
  kFormatResources,
  kFrom,
  kHighlightStyle,
  kHtmlMathMethod,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kInstitute,
  kInstitutes,
  kKeepSource,
  kLinkColor,
  kMath,
  kMetadataFormat,
  kNotebooks,
  kNotebookView,
  kNumberOffset,
  kNumberSections,
  kPageTitle,
  kQuartoInternal,
  kQuartoTemplateParams,
  kQuartoVarsKey,
  kQuartoVersion,
  kResources,
  kRevealJsScripts,
  kSectionTitleAbstract,
  kSelfContained,
  kSyntaxDefinitions,
  kTemplate,
  kTitle,
  kTitlePrefix,
  kTocLocation,
  kTocTitle,
  kTocTitleDocument,
  kTocTitleWebsite,
  kVariables,
} from "../../config/constants.ts";
import { TempContext } from "../../core/temp.ts";
import { discoverResourceRefs, fixEmptyHrefs } from "../../core/html.ts";

import { kDefaultHighlightStyle } from "./constants.ts";
import {
  HtmlPostProcessor,
  HtmlPostProcessResult,
  PandocOptions,
  RunPandocResult,
} from "./types.ts";
import { crossrefFilterActive } from "./crossref.ts";
import { overflowXPostprocessor } from "./layout.ts";
import {
  codeToolsPostprocessor,
  formatHasCodeTools,
  keepSourceBlock,
} from "./codetools.ts";
import { pandocMetadataPath } from "./render-paths.ts";
import { Metadata } from "../../config/types.ts";
import { resourcesFromMetadata } from "./resources.ts";
import { resolveSassBundles } from "./pandoc-html.ts";
import {
  cleanTemplatePartialMetadata,
  kTemplatePartials,
  readPartials,
  stageTemplate,
} from "./template.ts";
import {
  kYamlMetadataBlock,
  pandocFormatWith,
  parseFormatString,
  splitPandocFormatString,
} from "../../core/pandoc/pandoc-formats.ts";
import { parseAuthor } from "../../core/author.ts";
import { logLevel } from "../../core/log.ts";

import { cacheCodePage, clearCodePageCache } from "../../core/windows.ts";
import { textHighlightThemePath } from "../../quarto-core/text-highlighting.ts";
import { resolveAndFormatDate, resolveDate } from "../../core/date.ts";
import { katexPostProcessor } from "../../format/html/format-html-math.ts";
import {
  readAndInjectDependencies,
  writeDependencies,
} from "./pandoc-dependencies-html.ts";
import {
  processFormatResources,
  writeFormatResources,
} from "./pandoc-dependencies-resources.ts";
import {
  ExplicitTimingEntry,
  getLuaTiming,
  insertExplicitTimingEntries,
  withTiming,
} from "../../core/timing.ts";

import {
  requiresShortcodeUnescapePostprocessor,
  shortcodeUnescapePostprocessor,
} from "../../format/markdown/format-markdown.ts";

import { kRevealJSPlugins } from "../../extension/constants.ts";
import { kCitation } from "../../format/html/format-html-shared.ts";
import { cslDate } from "../../core/csl.ts";
import {
  createMarkdownPipeline,
  MarkdownPipelineHandler,
} from "../../core/markdown-pipeline.ts";

// in case we are running multiple pandoc processes
// we need to make sure we capture all of the trace files
let traceCount = 0;

export async function runPandoc(
  options: PandocOptions,
  sysFilters: string[],
): Promise<RunPandocResult | null> {
  const beforePandocHooks: (() => unknown)[] = [];
  const afterPandocHooks: (() => unknown)[] = [];
  const pandocEnv: { [key: string]: string } = {
    ...(options.flags?.env || {}),
  };

  // compute cwd for render
  const cwd = dirname(options.source);

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [pandocBinaryPath(), "+RTS", "-K512m", "-RTS"];

  // build command line args
  const args = [...options.args];

  // propagate debug
  if (logLevel() === "DEBUG") {
    args.push("--verbose");
    args.push("--trace");
  }

  // propagate quiet
  if (options.flags?.quiet || logLevel() === "ERROR") {
    args.push("--quiet");
  }

  // merge in any extra metadata
  if (options.metadata) {
    options.format.metadata = mergeConfigs(
      options.format.metadata,
      options.metadata,
    );
  }

  // save args and metadata so we can print them (we may subsequently edit them)
  const printArgs = [...args];
  let printMetadata = {
    ...ld.cloneDeep(options.format.metadata),
    ...options.flags?.metadata,
  };

  // remove some metadata that are used as parameters to our lua filters
  const cleanMetadataForPrinting = (metadata: Metadata) => {
    delete metadata.params;
    delete metadata[kQuartoInternal];
    delete metadata[kQuartoVarsKey];
    delete metadata[kQuartoVersion];
    delete metadata[kFigResponsive];
    delete metadata[kQuartoTemplateParams];
    delete metadata[kRevealJsScripts];
    deleteProjectMetadata(metadata);
    deleteCrossrefMetadata(metadata);

    // Don't print empty reveal-js plugins
    if (
      metadata[kRevealJSPlugins] &&
      (metadata[kRevealJSPlugins] as Array<unknown>).length === 0
    ) {
      delete metadata[kRevealJSPlugins];
    }
  };
  cleanMetadataForPrinting(printMetadata);

  // Forward flags metadata into the format
  kQuartoForwardedMetadataFields.forEach((field) => {
    if (options.flags?.pandocMetadata?.[field]) {
      options.format.metadata[field] = options.flags.pandocMetadata[field];
    }
  });

  // generate defaults and capture defaults to be printed
  let allDefaults = (await generateDefaults(options)) || {};
  let printAllDefaults = ld.cloneDeep(allDefaults) as FormatPandoc;

  // capture any filterParams in the FormatExtras
  const formatFilterParams = {} as Record<string, unknown>;

  // Note whether we should be forcing math on for this render

  const forceMath = options.format.metadata[kMath];
  delete options.format.metadata[kMath];

  // the "ojs" filter is a special value that results in us
  // just signaling our standard filter chain that the ojs
  // filter should be active
  const kOJSFilter = "ojs";
  if (sysFilters.includes(kOJSFilter)) {
    formatFilterParams[kOJSFilter] = true;
    sysFilters = sysFilters.filter((filter) => filter !== kOJSFilter);
  }

  // pass the format language along to filter params
  formatFilterParams["language"] = options.format.language;

  // if there is no toc title then provide the appropirate default
  if (
    !options.format.metadata[kTocTitle] && !isAstOutput(options.format.pandoc)
  ) {
    options.format.metadata[kTocTitle] = options.format.language[
      (projectIsWebsite(options.project) && !projectIsBook(options.project) &&
          isHtmlOutput(options.format.pandoc, true))
        ? kTocTitleWebsite
        : kTocTitleDocument
    ];
  }

  // if toc-location is set, enable the TOC as well
  if (
    options.format.metadata[kTocLocation] &&
    options.format.pandoc.toc === undefined
  ) {
    options.format.pandoc.toc = true;
  }

  // if there is an abtract then forward abtract-title
  if (
    options.format.metadata[kAbstract] &&
    (isHtmlDocOutput(options.format.pandoc) ||
      isEpubOutput(options.format.pandoc))
  ) {
    options.format.metadata[kAbstractTitle] =
      options.format.metadata[kAbstractTitle] ||
      options.format.language[kSectionTitleAbstract];
  }

  // see if there are extras
  const postprocessors: Array<
    (
      output: string,
    ) => Promise<{ supporting?: string[]; resources?: string[] } | void>
  > = [];
  const htmlPostprocessors: Array<HtmlPostProcessor> = [];
  const htmlFinalizers: Array<(doc: Document) => Promise<void>> = [];
  const htmlRenderAfterBody: string[] = [];
  const dependenciesFile = options.services.temp.createFile();

  if (
    sysFilters.length > 0 || options.format.formatExtras ||
    options.project?.formatExtras
  ) {
    const projectExtras = options.project?.formatExtras
      ? (await options.project.formatExtras(
        options.project,
        options.source,
        options.flags || {},
        options.format,
        options.services,
      ))
      : {};

    const formatExtras = options.format.formatExtras
      ? (await options.format.formatExtras(
        options.source,
        options.markdown,
        options.flags || {},
        options.format,
        options.libDir,
        options.services,
        options.offset,
        options.project,
        options.quiet,
      ))
      : {};

    const extras = await resolveExtras(
      projectExtras,
      formatExtras,
      options.format,
      cwd,
      options.libDir,
      options.services.temp,
      dependenciesFile,
      options.project,
    );

    // record postprocessors
    postprocessors.push(...(extras.postprocessors || []));

    // add a keep-source post processor if we need one
    if (
      options.format?.render[kKeepSource] || formatHasCodeTools(options.format)
    ) {
      htmlPostprocessors.push(codeToolsPostprocessor(options.format));
    }

    // save post-processors
    htmlPostprocessors.push(...(extras.html?.[kHtmlPostprocessors] || []));

    // Save finalizers
    htmlFinalizers.push(...(extras.html?.[kHtmlFinalizers] || []));

    if (isHtmlFileOutput(options.format.pandoc)) {
      // add a post-processor for fixing overflow-x in cell output display
      htmlPostprocessors.push(overflowXPostprocessor);

      // katex post-processor
      if (
        options.flags?.katex ||
        options.format.pandoc[kHtmlMathMethod] === "katex"
      ) {
        htmlPostprocessors.push(katexPostProcessor());
      }

      if (!projectIsWebsite(options.project)) {
        // add a resource discovery postProcessor if we are not in a website project
        htmlPostprocessors.push(discoverResourceRefs);

        // in order for tabsets etc to show the right mouse cursor,
        // we need hrefs in anchor elements to be "empty" instead of missing.
        // Existing href attributes trigger the any-link pseudo-selector that
        // browsers set to `cursor: pointer`.
        //
        // In project websites, quarto-nav.js does the same thing so this step
        // isn't necessary.

        htmlPostprocessors.push(fixEmptyHrefs);
      }

      // Include Math, if explicitly requested (this will result
      // in math dependencies being injected into the page)
      if (forceMath) {
        const htmlMarkdownHandlers: MarkdownPipelineHandler[] = [];
        htmlMarkdownHandlers.push({
          getUnrendered: () => {
            return {
              inlines: {
                "quarto-enable-math-inline": "$e = mC^2$",
              },
            };
          },
          processRendered: (
            _rendered: unknown,
            _doc: Document,
          ) => {
          },
        });

        const htmlMarkdownPipeline = createMarkdownPipeline(
          "quarto-book-math",
          htmlMarkdownHandlers,
        );

        const htmlPipelinePostProcessor = (
          doc: Document,
        ): Promise<HtmlPostProcessResult> => {
          htmlMarkdownPipeline.processRenderedMarkdown(doc);
          return Promise.resolve({
            resources: [],
            supporting: [],
          });
        };

        htmlRenderAfterBody.push(htmlMarkdownPipeline.markdownAfterBody());
        htmlPostprocessors.push(htmlPipelinePostProcessor);
      }
    }

    // Capture markdown that should be appended post body
    htmlRenderAfterBody.push(...(extras.html?.[kMarkdownAfterBody] || []));

    // merge sysFilters if we have them
    if (sysFilters.length > 0) {
      extras.filters = extras.filters || {};
      extras.filters.post = extras.filters.post || [];
      extras.filters.post.unshift(
        ...(sysFilters.map((filter) => resourcePath(join("filters", filter)))),
      );
    }

    // merge args
    if (extras.args) {
      args.push(...extras.args);
      printArgs.push(...extras.args);
    }

    // merge pandoc
    if (extras.pandoc) {
      // Special case - we need to more intelligently merge pandoc from
      // by breaking apart the from string
      if (
        typeof (allDefaults[kFrom]) === "string" &&
        typeof (extras.pandoc[kFrom]) === "string"
      ) {
        const userFrom = splitPandocFormatString(allDefaults[kFrom] as string);
        const extrasFrom = splitPandocFormatString(
          extras.pandoc[kFrom] as string,
        );
        allDefaults[kFrom] = pandocFormatWith(
          userFrom.format,
          "",
          extrasFrom.options + userFrom.options,
        );
        printAllDefaults[kFrom] = allDefaults[kFrom];
      }

      allDefaults = mergeConfigs(extras.pandoc, allDefaults);
      printAllDefaults = mergeConfigs(extras.pandoc, printAllDefaults);

      // Special case - theme is resolved on extras and should override allDefaults
      if (extras.pandoc[kHighlightStyle] === null) {
        delete printAllDefaults[kHighlightStyle];
        allDefaults[kHighlightStyle] = null;
      } else if (extras.pandoc[kHighlightStyle]) {
        delete printAllDefaults[kHighlightStyle];
        allDefaults[kHighlightStyle] = extras.pandoc[kHighlightStyle];
      } else {
        delete printAllDefaults[kHighlightStyle];
        delete allDefaults[kHighlightStyle];
      }
    }

    // merge metadata
    if (extras.metadata || extras.metadataOverride) {
      options.format.metadata = {
        ...mergeConfigs(
          extras.metadata || {},
          options.format.metadata,
        ),
        ...extras.metadataOverride || {},
      };
      printMetadata = mergeConfigs(extras.metadata, printMetadata);
      cleanMetadataForPrinting(printMetadata);
    }

    // merge notebooks that have been provided by the document / user
    // or by the project as format extras
    if (extras[kNotebooks]) {
      const documentNotebooks = options.format.render[kNotebookView];
      // False means taht the user has explicitely disabled notebooks
      if (documentNotebooks !== false) {
        const userNotebooks = documentNotebooks === true
          ? []
          : Array.isArray(documentNotebooks)
          ? documentNotebooks
          : documentNotebooks !== undefined
          ? [documentNotebooks]
          : [];

        options.format.render[kNotebookView] = [
          ...extras[kNotebooks],
          ...userNotebooks,
        ];
      }
    }

    // clean 'columns' from pandoc defaults to typst
    if (isTypstOutput(options.format.pandoc)) {
      delete allDefaults[kColumns];
      delete printAllDefaults[kColumns];
    }

    // The user template (if any)
    const userTemplate = getPandocArg(args, "--template") ||
      allDefaults[kTemplate];

    // The user partials (if any)
    const userPartials = readPartials(options.format.metadata, cwd);
    const inputDir = normalizePath(cwd);
    const resolvePath = (path: string) => {
      if (isAbsolute(path)) {
        return path;
      } else {
        return join(inputDir, path);
      }
    };

    const templateContext = extras.templateContext;
    if (templateContext) {
      // Clean the template partial output
      cleanTemplatePartialMetadata(
        printMetadata,
        templateContext.partials || [],
      );

      // The format is providing a more robust local template
      // to use, stage the template and pass it on to pandoc
      const template = userTemplate
        ? resolvePath(userTemplate)
        : templateContext.template;

      // Validate any user partials
      if (!userTemplate && userPartials.length > 0) {
        const templateNames = templateContext.partials?.map((temp) =>
          basename(temp)
        );

        if (templateNames) {
          const userPartialNames = userPartials.map((userPartial) =>
            basename(userPartial)
          );

          const hasAtLeastOnePartial = userPartialNames.find((userPartial) => {
            return templateNames.includes(userPartial);
          });

          if (!hasAtLeastOnePartial) {
            const errorMsg =
              `The format '${allDefaults.to}' only supports the following partials:\n${
                templateNames.join("\n")
              }\n\nPlease provide one or more of these partials.`;
            throw new Error(errorMsg);
          }
        } else {
          throw new Error(
            `The format ${allDefaults.to} does not support providing any template partials.`,
          );
        }
      }

      // Place any user partials at the end of the list of partials
      const partials: string[] = templateContext.partials || [];
      partials.push(...userPartials);

      // Stage the template and partials
      const stagedTemplate = await stageTemplate(
        options,
        extras,
        {
          template,
          partials,
        },
      );

      // Clean out partials from metadata, they are not needed downstream
      delete options.format.metadata[kTemplatePartials];

      allDefaults[kTemplate] = stagedTemplate;
    } else {
      // ipynb is allowed to have templates without warning
      if (userPartials.length > 0 && !isIpynbOutput(options.format.pandoc)) {
        // The user passed partials to a format that doesn't support
        // staging and partials.
        throw new Error(
          `The format ${allDefaults.to} does not support providing any template partials.`,
        );
      } else if (userTemplate) {
        // Use the template provided by the user
        allDefaults[kTemplate] = userTemplate;
      }
    }

    // more cleanup
    options.format.metadata = cleanupPandocMetadata(options.format.metadata);
    printMetadata = cleanupPandocMetadata(printMetadata);

    if (extras[kIncludeInHeader]) {
      if (
        allDefaults[kIncludeInHeader] !== undefined &&
        !ld.isArray(allDefaults[kIncludeInHeader])
      ) {
        // FIXME we need to fix the type up in FormatExtras..
        allDefaults[kIncludeInHeader] = [
          allDefaults[kIncludeInHeader],
        ] as unknown as string[];
      }
      allDefaults = {
        ...allDefaults,
        [kIncludeInHeader]: [
          ...extras[kIncludeInHeader] || [],
          ...allDefaults[kIncludeInHeader] || [],
        ],
      };
    }
    if (
      extras[kIncludeBeforeBody]
    ) {
      if (
        allDefaults[kIncludeBeforeBody] !== undefined &&
        !ld.isArray(allDefaults[kIncludeBeforeBody])
      ) {
        // FIXME we need to fix the type up in FormatExtras..
        allDefaults[kIncludeBeforeBody] = [
          allDefaults[kIncludeBeforeBody],
        ] as unknown as string[];
      }
      allDefaults = {
        ...allDefaults,
        [kIncludeBeforeBody]: [
          ...extras[kIncludeBeforeBody] || [],
          ...allDefaults[kIncludeBeforeBody] || [],
        ],
      };
    }
    if (extras[kIncludeAfterBody]) {
      if (
        allDefaults[kIncludeAfterBody] !== undefined &&
        !ld.isArray(allDefaults[kIncludeAfterBody])
      ) {
        // FIXME we need to fix the type up in FormatExtras..
        allDefaults[kIncludeAfterBody] = [
          allDefaults[kIncludeAfterBody],
        ] as unknown as string[];
      }
      allDefaults = {
        ...allDefaults,
        [kIncludeAfterBody]: [
          ...allDefaults[kIncludeAfterBody] || [],
          ...extras[kIncludeAfterBody] || [],
        ],
      };
    }

    // Resolve the body envelope here
    // body envelope to includes (project body envelope always wins)
    if (extras.html?.[kBodyEnvelope] && projectExtras.html?.[kBodyEnvelope]) {
      extras.html[kBodyEnvelope] = projectExtras.html[kBodyEnvelope];
    }
    resolveBodyEnvelope(allDefaults, extras, options.services.temp);

    // add any filters
    allDefaults.filters = [
      ...extras.filters?.pre || [],
      ...allDefaults.filters || [],
      ...extras.filters?.post || [],
    ];

    // make the filter paths windows safe
    allDefaults.filters = allDefaults.filters.map((filter) => {
      if (typeof (filter) === "string") {
        return pandocMetadataPath(filter);
      } else {
        return {
          type: filter.type,
          path: pandocMetadataPath(filter.path),
        };
      }
    });

    // Capture any format filter params
    const filterParams = extras[kFilterParams];
    if (filterParams) {
      Object.keys(filterParams).forEach((key) => {
        formatFilterParams[key] = filterParams[key];
      });
    }
  }

  // add a shortcode escaping post-processor if we need one
  if (
    isMarkdownOutput(options.format) &&
    requiresShortcodeUnescapePostprocessor(options.markdown)
  ) {
    postprocessors.push(shortcodeUnescapePostprocessor);
  }

  // resolve some title variables
  const title = allDefaults?.[kVariables]?.[kTitle] ||
    options.format.metadata[kTitle];
  const pageTitle = allDefaults?.[kVariables]?.[kPageTitle] ||
    options.format.metadata[kPageTitle];
  const titlePrefix = allDefaults?.[kTitlePrefix];

  // provide default page title if necessary
  if (!title && !pageTitle && isHtmlFileOutput(options.format.pandoc)) {
    const [_dir, stem] = dirAndStem(options.source);
    args.push(
      "--metadata",
      `pagetitle:${pandocAutoIdentifier(stem, false)}`,
    );
  }

  // don't ever duplicate pagetite/title and title-prefix
  if (
    (pageTitle !== undefined && pageTitle === titlePrefix) ||
    (pageTitle === undefined && title === titlePrefix)
  ) {
    delete allDefaults[kTitlePrefix];
  }

  // if we are doing keepYaml then remove it from pandoc 'to'
  if (options.keepYaml && allDefaults.to) {
    allDefaults.to = allDefaults.to.replaceAll(`+${kYamlMetadataBlock}`, "");
  }

  // Attempt to cache the code page, if this windows.
  // We cache the code page to prevent looking it up
  // in the registry repeatedly (which triggers MS Defender)
  if (Deno.build.os === "windows") {
    await cacheCodePage();
  }

  // filter results json file
  const filterResultsFile = options.services.temp.createFile();

  // timing results json file
  const timingResultsFile = options.services.temp.createFile();

  const writerKeys: ("to" | "writer")[] = ["to", "writer"];
  for (const key of writerKeys) {
    if (allDefaults[key]?.match(/[.]lua$/)) {
      formatFilterParams["custom-writer"] = allDefaults[key];
      allDefaults[key] = resourcePath("filters/customwriter/customwriter.lua");
    }
  }

  // set up the custom .qmd reader
  if (allDefaults.from) {
    formatFilterParams["user-defined-from"] = allDefaults.from;
  }
  allDefaults.from = resourcePath("filters/qmd-reader.lua");

  // set parameters required for filters (possibily mutating all of it's arguments
  // to pull includes out into quarto parameters so they can be merged)
  let pandocArgs = args;
  const paramsJson = await filterParamsJson(
    pandocArgs,
    options,
    allDefaults,
    formatFilterParams,
    filterResultsFile,
    dependenciesFile,
    timingResultsFile,
  );

  // remove selected args and defaults if we are handling some things on behalf of pandoc
  // (e.g. handling section numbering). note that section numbering is handled by the
  // crossref filter so we only do this if the user hasn't disabled the crossref filter
  if (
    !isLatexOutput(options.format.pandoc) &&
    !isTypstOutput(options.format.pandoc) &&
    !isMarkdownOutput(options.format) && crossrefFilterActive(options)
  ) {
    delete allDefaults[kNumberSections];
    delete allDefaults[kNumberOffset];
    const removeArgs = new Map<string, boolean>();
    removeArgs.set("--number-sections", false);
    removeArgs.set("--number-offset", true);
    pandocArgs = removePandocArgs(pandocArgs, removeArgs);
  }

  // https://github.com/quarto-dev/quarto-cli/issues/3126
  // it seems that we still need to coerce number-offset to be an number list,
  // otherwise pandoc fails.
  if (typeof allDefaults[kNumberOffset] === "number") {
    allDefaults[kNumberOffset] = [allDefaults[kNumberOffset]];
  }

  // We always use our own pandoc data-dir, so tear off the user
  // data-dir and use ours.
  const dataDirArgs = new Map<string, boolean>();
  dataDirArgs.set("--data-dir", true);
  pandocArgs = removePandocArgs(
    pandocArgs,
    dataDirArgs,
  );
  pandocArgs.push("--data-dir", resourcePath("pandoc/datadir"));

  // add any built-in syntax definition files
  allDefaults[kSyntaxDefinitions] = allDefaults[kSyntaxDefinitions] || [];
  const syntaxDefinitions = expandGlobSync(
    join(resourcePath(join("pandoc", "syntax-definitions")), "*.xml"),
  );
  for (const syntax of syntaxDefinitions) {
    allDefaults[kSyntaxDefinitions]?.push(syntax.path);
  }

  // provide default webtex url
  if (allDefaults[kHtmlMathMethod] === "webtex") {
    allDefaults[kHtmlMathMethod] = {
      method: "webtex",
      url: "https://latex.codecogs.com/svg.latex?",
    };
  }

  // provide alternate markdown template that actually prints the title block
  if (
    !allDefaults[kTemplate] && !havePandocArg(args, "--template") &&
    !options.keepYaml &&
    allDefaults.to
  ) {
    const formatDesc = parseFormatString(allDefaults.to);
    const lookupTo = formatDesc.baseFormat;
    if (
      [
        "gfm",
        "commonmark",
        "commonmark_x",
        "markdown_strict",
        "markdown_phpextra",
        "markdown_github",
        "markua",
      ].includes(
        lookupTo,
      )
    ) {
      allDefaults[kTemplate] = resourcePath(
        join("pandoc", "templates", "default.markdown"),
      );
    }
  }

  // "Hide" self contained from pandoc. Since we inject dependencies
  // during post processing, we need to implement self-contained ourselves
  // so don't allow pandoc to see this flag (but still print it)
  if (isHtmlFileOutput(options.format.pandoc)) {
    // Hide self-contained arguments
    pandocArgs = pandocArgs.filter((
      arg,
    ) => (arg !== "--self-contained" && arg !== "--embed-resources"));

    // Remove from defaults
    delete allDefaults[kSelfContained];
    delete allDefaults[kEmbedResources];
  }

  // write the defaults file
  if (allDefaults) {
    const defaultsFile = await writeDefaultsFile(
      allDefaults,
      options.services.temp,
    );
    cmd.push("--defaults", defaultsFile);
  }

  // remove front matter from markdown (we've got it all incorporated into options.format.metadata)
  // also save the engine metadata as that will have the result of e.g. resolved inline expressions,
  // (which we will use immediately below)
  const paritioned = partitionYamlFrontMatter(options.markdown);
  const engineMetadata =
    (paritioned?.yaml ? readYamlFromMarkdown(paritioned.yaml) : {}) as Metadata;
  const markdown = paritioned?.markdown || options.markdown;

  // selectively overwrite some resolved metadata (e.g. ensure that metadata
  // computed from inline r expressions gets included @ the bottom).
  const pandocMetadata = ld.cloneDeep(options.format.metadata || {});
  for (const key of Object.keys(engineMetadata)) {
    const isChapterTitle = key === kTitle && projectIsBook(options.project);

    if (!isQuartoMetadata(key) && !isChapterTitle && !isIncludeMetadata(key)) {
      // if it's standard pandoc metadata and NOT contained in a format specific
      // override then use the engine metadata value

      // don't do if they've overridden the value in a format
      const formats = engineMetadata[kMetadataFormat] as Metadata;
      if (ld.isObject(formats) && metadataGetDeep(formats, key).length > 0) {
        continue;
      }
      // perform the override
      pandocMetadata[key] = engineMetadata[key];
    }
  }

  // Resolve any date fields
  const dateRaw = pandocMetadata[kDate];
  const dateFields = [kDate, kDateModified];
  dateFields.forEach((dateField) => {
    const date = pandocMetadata[dateField];
    const format = pandocMetadata[kDateFormat];
    pandocMetadata[dateField] = resolveAndFormatDate(
      options.source,
      date,
      format,
    );
  });

  // Ensure that citationMetadata is expanded into
  // and object for downstream use
  if (
    typeof (pandocMetadata[kCitation]) === "boolean" &&
    pandocMetadata[kCitation] === true
  ) {
    pandocMetadata[kCitation] = {};
  }

  // Expand citation dates into CSL dates
  const citationMetadata = pandocMetadata[kCitation];
  if (citationMetadata) {
    const docCSLDate = dateRaw
      ? cslDate(resolveDate(options.source, dateRaw))
      : undefined;
    const fields = ["issued", "available-date"];
    fields.forEach((field) => {
      if (citationMetadata[field]) {
        citationMetadata[field] = cslDate(citationMetadata[field]);
      } else if (docCSLDate) {
        citationMetadata[field] = docCSLDate;
      }
    });
  }

  // Resolve the author metadata into a form that Pandoc will recognize
  const authorsRaw = pandocMetadata[kAuthors] || pandocMetadata[kAuthor];
  if (authorsRaw) {
    const authors = parseAuthor(pandocMetadata[kAuthor], true);
    if (authors) {
      pandocMetadata[kAuthor] = authors.map((author) => author.name);
      pandocMetadata[kAuthors] = Array.isArray(authorsRaw)
        ? authorsRaw
        : [authorsRaw];
    }
  }

  // Ensure that there are institutes around for use when resolving authors
  // and affilations
  const instituteRaw = pandocMetadata[kInstitute];
  if (instituteRaw) {
    pandocMetadata[kInstitutes] = Array.isArray(instituteRaw)
      ? instituteRaw
      : [instituteRaw];
  }

  // If the user provides only `zh` as a lang, disambiguate to 'simplified'
  if (pandocMetadata.lang === "zh") {
    pandocMetadata.lang = "zh-Hans";
  }

  // If there are no specified options for link coloring in PDF, set them
  // do not color links for obviously printed book output or beamer presentations
  if (
    isLatexOutput(options.format.pandoc) &&
    !isBeamerOutput(options.format.pandoc)
  ) {
    const docClass = pandocMetadata[kDocumentClass];
    const isPrintDocumentClass = docClass &&
      ["book", "scrbook"].includes(docClass);

    if (!isPrintDocumentClass) {
      if (pandocMetadata[kColorLinks] === undefined) {
        pandocMetadata[kColorLinks] = true;
      }

      if (pandocMetadata[kLinkColor] === undefined) {
        pandocMetadata[kLinkColor] = "blue";
      }
    }
  }

  // If the format provides any additional markdown to render after the body
  // then append that before rendering
  const markdownWithRenderAfter =
    isHtmlOutput(options.format.pandoc) && htmlRenderAfterBody.length > 0
      ? markdown + "\n\n\n" + htmlRenderAfterBody.join("\n") + "\n\n"
      : markdown;

  // append render after + keep-source if requested
  const input = markdownWithRenderAfter +
    keepSourceBlock(options.format, options.source);

  // write input to temp file and pass it to pandoc
  const inputTemp = options.services.temp.createFile({
    prefix: "quarto-input",
    suffix: ".md",
  });
  Deno.writeTextFileSync(inputTemp, input);
  cmd.push(inputTemp);

  // Pass metadata to Pandoc. This metadata reflects all of our merged project and format
  // metadata + the user's original metadata from the top of the document. Note that we
  // used to append this to the end of the file (so it would always 'win' over the front-matter
  // at the top) however we ran into problems w/ the pandoc parser seeing an hr (------)
  // followed by text on the next line as the beginning of a table that was terminated
  // with our yaml block! Note that subsequent to the original implementation we started
  // stripping the yaml from the top, see:
  //   https://github.com/quarto-dev/quarto-cli/commit/35f4729defb20ceb8b45e08d0a97c079e7a3bab6
  // The way this yaml is now processed relative to other yaml sources is described in
  // the docs for --metadata-file:
  //   Values in files specified later on the command line will be preferred over those
  //   specified in earlier files. Metadata values specified inside the document, or by
  //   using -M, overwrite values specified with this option.
  // This gives the semantics we want, as our metadata is 'logically' at the top of the
  // file and subsequent blocks within the file should indeed override it (as should
  // user invocations of --metadata-file or -M, which are included below in pandocArgs)
  const metadataTemp = options.services.temp.createFile({
    prefix: "quarto-metadata",
    suffix: ".yml",
  });
  const pandocPassedMetadata = ld.cloneDeep(pandocMetadata);
  delete pandocPassedMetadata.format;
  delete pandocPassedMetadata.project;
  delete pandocPassedMetadata.website;
  if (pandocPassedMetadata._quarto) {
    // these shouldn't be visible because they are emitted on markdown output
    // and it breaks ensureFileRegexMatches
    delete pandocPassedMetadata._quarto.tests;
  }

  Deno.writeTextFileSync(
    metadataTemp,
    stringify(pandocPassedMetadata, {
      indent: 2,
      lineWidth: -1,
      sortKeys: false,
      skipInvalid: true,
    }),
  );
  cmd.push("--metadata-file", metadataTemp);

  // add user command line args
  cmd.push(...pandocArgs);

  // print full resolved input to pandoc
  if (!options.quiet && !options.flags?.quiet) {
    runPandocMessage(
      printArgs,
      printAllDefaults,
      sysFilters,
      printMetadata,
    );
  }

  // workaround for our wonky Lua timing routines
  const luaEpoch = await getLuaTiming();

  pandocEnv["QUARTO_FILTER_PARAMS"] = base64Encode(paramsJson);

  const traceFilters = pandocMetadata?.["_quarto"]?.["trace-filters"] ||
    Deno.env.get("QUARTO_TRACE_FILTERS");

  if (traceFilters) {
    beforePandocHooks.push(() => {
      // in case we are running multiple pandoc processes
      // we need to make sure we capture all of the trace files
      let traceCountSuffix = "";
      if (traceCount > 0) {
        traceCountSuffix = `-${traceCount}`;
      }
      ++traceCount;
      if (traceFilters === true) {
        pandocEnv["QUARTO_TRACE_FILTERS"] = "quarto-filter-trace.json" +
          traceCountSuffix;
      } else {
        pandocEnv["QUARTO_TRACE_FILTERS"] = traceFilters + traceCountSuffix;
      }
    });
  }

  // run beforePandoc hooks
  for (const hook of beforePandocHooks) {
    await hook();
  }

  // run pandoc
  const result = await execProcess(
    {
      cmd,
      cwd,
      env: pandocEnv,
    },
  );

  // run afterPandoc hooks
  for (const hook of afterPandocHooks) {
    await hook();
  }

  // resolve resource files from metadata
  const resources: string[] = resourcesFromMetadata(
    options.format.metadata[kResources],
  );

  // read any resourceFiles generated by filters
  let inputTraits = {};
  if (existsSync(filterResultsFile)) {
    const filterResultsJSON = Deno.readTextFileSync(filterResultsFile);
    if (filterResultsJSON.trim().length > 0) {
      const filterResults = JSON.parse(filterResultsJSON);

      // Read any input traits
      inputTraits = filterResults.inputTraits;

      // Read any resource files
      const resourceFiles = filterResults.resourceFiles || [];
      resources.push(...resourceFiles);
    }
  }

  if (existsSync(timingResultsFile)) {
    const timingResultsJSON = Deno.readTextFileSync(timingResultsFile);
    if (
      timingResultsJSON.length > 0 && Deno.env.get("QUARTO_PROFILER_OUTPUT")
    ) {
      // workaround for our wonky Lua timing routines
      const luaNow = await getLuaTiming();
      const entries = JSON.parse(timingResultsJSON) as ExplicitTimingEntry[];

      insertExplicitTimingEntries(
        luaEpoch,
        luaNow,
        entries,
        "pandoc",
      );
    }
  }

  if (result.success) {
    return {
      inputMetadata: pandocMetadata,
      inputTraits,
      resources,
      postprocessors,
      htmlPostprocessors: isHtmlOutput(options.format.pandoc)
        ? htmlPostprocessors
        : [],
      htmlFinalizers: isHtmlDocOutput(options.format.pandoc)
        ? htmlFinalizers
        : [],
    };
  } else {
    // Since this render wasn't successful, clear the code page cache
    // (since the code page could've changed and we could be caching the
    // wrong value)
    if (Deno.build.os === "windows") {
      clearCodePageCache();
    }

    return null;
  }
}

function cleanupPandocMetadata(metadata: Metadata) {
  const cleaned = ld.cloneDeep(metadata);

  // pdf classoption can end up with duplicaed options
  const classoption = cleaned[kClassOption];
  if (Array.isArray(classoption)) {
    cleaned[kClassOption] = ld.uniqBy(
      classoption.reverse(),
      (option: string) => {
        return option.replace(/=.+$/, "");
      },
    ).reverse();
  }

  return cleaned;
}

async function resolveExtras(
  projectExtras: FormatExtras,
  formatExtras: FormatExtras,
  format: Format,
  inputDir: string,
  libDir: string,
  temp: TempContext,
  dependenciesFile: string,
  project?: ProjectContext,
) {
  // start with the merge
  let extras = mergeConfigs(projectExtras, formatExtras);

  // project documentclass always wins
  if (projectExtras.metadata?.[kDocumentClass]) {
    extras.metadata = extras.metadata || {};
    extras.metadata[kDocumentClass] = projectExtras.metadata?.[kDocumentClass];
  }

  // resolve format resources
  writeFormatResources(
    inputDir,
    dependenciesFile,
    format.render[kFormatResources],
  );

  // perform html-specific merging
  if (isHtmlOutput(format.pandoc)) {
    // resolve sass bundles
    extras = await resolveSassBundles(
      inputDir,
      extras,
      format.pandoc,
      temp,
      formatExtras.html?.[kSassBundles],
      projectExtras.html?.[kSassBundles],
      project,
    );

    // resolve dependencies
    writeDependencies(dependenciesFile, extras);

    const htmlDependenciesPostProcesor = (
      doc: Document,
      _inputMedata: Metadata,
    ): Promise<HtmlPostProcessResult> => {
      return withTiming(
        "pandocDependenciesPostProcessor",
        async () =>
          await readAndInjectDependencies(
            dependenciesFile,
            inputDir,
            libDir,
            doc,
            project,
          ),
      );
    };

    // Add a post processor to resolve dependencies
    extras.html = extras.html || {};
    extras.html[kHtmlPostprocessors] = extras.html?.[kHtmlPostprocessors] || [];
    if (isHtmlFileOutput(format.pandoc)) {
      extras.html[kHtmlPostprocessors]!.unshift(htmlDependenciesPostProcesor);
    }

    // Remove the dependencies which will now process in the post
    // processor
    delete extras.html?.[kDependencies];
  } else {
    delete extras.html;
  }

  // Process format resources
  const resourceDependenciesPostProcessor = async (_output: string) => {
    return await processFormatResources(inputDir, dependenciesFile);
  };
  extras.postprocessors = extras.postprocessors || [];
  extras.postprocessors.push(resourceDependenciesPostProcessor);

  // Resolve the highlighting theme (if any)
  extras = resolveTextHighlightStyle(
    inputDir,
    extras,
    format.pandoc,
  );

  return extras;
}

function resolveBodyEnvelope(
  pandoc: FormatPandoc,
  extras: FormatExtras,
  temp: TempContext,
) {
  const envelope = extras.html?.[kBodyEnvelope];
  if (envelope) {
    const writeBodyFile = (
      type: "include-in-header" | "include-before-body" | "include-after-body",
      prepend: boolean, // should we prepend or append this element
      content?: string,
    ) => {
      if (content) {
        const file = temp.createFile({ suffix: ".html" });
        Deno.writeTextFileSync(file, content);
        if (!prepend) {
          pandoc[type] = (pandoc[type] || []).concat(file);
        } else {
          pandoc[type] = [file].concat(pandoc[type] || []);
        }
      }
    };
    writeBodyFile(kIncludeInHeader, true, envelope.header);
    writeBodyFile(kIncludeBeforeBody, true, envelope.before);

    // Process the after body preamble and postamble (include-after-body appears between these)
    writeBodyFile(kIncludeAfterBody, true, envelope.afterPreamble);
    writeBodyFile(kIncludeAfterBody, false, envelope.afterPostamble);
  }
}

function runPandocMessage(
  args: string[],
  pandoc: FormatPandoc | undefined,
  sysFilters: string[],
  metadata: Metadata,
  debug?: boolean,
) {
  info(`pandoc ${args.join(" ")}`, { bold: true });
  if (pandoc) {
    info(pandocDefaultsMessage(pandoc, sysFilters, debug), { indent: 2 });
  }

  const keys = Object.keys(metadata);
  if (keys.length > 0) {
    const printMetadata = ld.cloneDeep(metadata) as Metadata;
    delete printMetadata.format;

    // remove filter params
    removeFilterParams(printMetadata);
    // print message
    if (Object.keys(printMetadata).length > 0) {
      info("metadata", { bold: true });
      info(
        stringify(printMetadata, {
          indent: 2,
          lineWidth: -1,
          sortKeys: false,
          skipInvalid: true,
        }),
        { indent: 2 },
      );
    }
  }
}

function resolveTextHighlightStyle(
  inputDir: string,
  extras: FormatExtras,
  pandoc: FormatPandoc,
): FormatExtras {
  extras = ld.cloneDeep(extras);

  // Get the user selected theme or choose a default
  const highlightTheme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  const textHighlightingMode = extras.html?.[kTextHighlightingMode];

  if (highlightTheme === "none") {
    // Clear the highlighting
    extras.pandoc = extras.pandoc || {};
    extras.pandoc[kHighlightStyle] = null;
    return extras;
  }

  // create the possible name matches based upon the dark vs. light
  // and find a matching theme file
  // Themes from
  // https://invent.kde.org/frameworks/syntax-highlighting/-/tree/master/data/themes
  switch (textHighlightingMode) {
    case "light":
    case "dark":
      // Set light or dark mode as appropriate
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kHighlightStyle] = textHighlightThemePath(
        inputDir,
        highlightTheme,
        textHighlightingMode,
      ) ||
        highlightTheme;

      break;
    case "none":
      // Clear the highlighting
      if (extras.pandoc) {
        extras.pandoc = extras.pandoc || {};
        extras.pandoc[kHighlightStyle] = textHighlightThemePath(
          inputDir,
          "none",
        );
      }
      break;
    case undefined:
    default:
      // Set the the light (default) highlighting mode
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kHighlightStyle] =
        textHighlightThemePath(inputDir, highlightTheme, "light") ||
        highlightTheme;
      break;
  }
  return extras;
}
