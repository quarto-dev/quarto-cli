/*
 * pandoc.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import {
  basename,
  dirname,
  isAbsolute,
  join,
  resolve,
} from "../../deno_ral/path.ts";

import { info, warning } from "../../deno_ral/log.ts";

import { ensureDir, existsSync, expandGlobSync } from "../../deno_ral/fs.ts";

import { parse as parseYml, stringify } from "../../core/yaml.ts";
import { copyTo } from "../../core/copy.ts";
import { decodeBase64, encodeBase64 } from "encoding/base64";

import * as ld from "../../core/lodash.ts";

import { Document } from "../../core/deno-dom.ts";

import { execProcess } from "../../core/process.ts";
import { dirAndStem, normalizePath } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";
import { isExternalPath } from "../../core/url.ts";

import {
  Format,
  FormatExtras,
  FormatPandoc,
  kBodyEnvelope,
  kDependencies,
  kHtmlFinalizers,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
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
  isRevealjsOutput,
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
import { migrateProjectScratchPath } from "../../project/project-scratch.ts";

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
  kFontPaths,
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
  kLatexAutoMk,
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
  kSyntaxHighlighting,
  kTemplate,
  kTheme,
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
  resolveTemplatePartialPaths,
  stageTemplate,
} from "./template.ts";
import {
  kYamlMetadataBlock,
  pandocFormatWith,
  parseFormatString,
  splitPandocFormatString,
} from "../../core/pandoc/pandoc-formats.ts";
import { cslNameToString, parseAuthor } from "../../core/author.ts";
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
import { withTiming } from "../../core/timing.ts";

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
import { getenv } from "../../core/env.ts";
import { Zod } from "../../resources/types/zod/schema-types.ts";
import { kFieldCategories } from "../../project/types/website/listing/website-listing-shared.ts";
import { isWindows } from "../../deno_ral/platform.ts";
import { appendToCombinedLuaProfile } from "../../core/performance/perfetto-utils.ts";
import { makeTimedFunctionAsync } from "../../core/performance/function-times.ts";
import { walkJson } from "../../core/json.ts";
import { safeCloneDeep } from "../../core/safe-clone-deep.ts";
import { assert } from "testing/asserts";
import { call } from "../../deno_ral/process.ts";

// in case we are running multiple pandoc processes
// we need to make sure we capture all of the trace files
let traceCount = 0;

const handleCombinedLuaProfiles = (
  source: string,
  paramsJson: Record<string, unknown>,
  temp: TempContext,
) => {
  const beforePandocHooks: (() => unknown)[] = [];
  const afterPandocHooks: (() => unknown)[] = [];
  const tmp = temp.createFile();

  const combinedProfile = Deno.env.get("QUARTO_COMBINED_LUA_PROFILE");
  if (combinedProfile) {
    beforePandocHooks.push(() => {
      paramsJson["lua-profiler-output"] = tmp;
    });
    afterPandocHooks.push(() => {
      appendToCombinedLuaProfile(
        source,
        tmp,
        combinedProfile,
      );
    });
  }
  return {
    before: beforePandocHooks,
    after: afterPandocHooks,
  };
};

function captureRenderCommand(
  args: Deno.CommandOptions,
  temp: TempContext,
  outputDir: string,
) {
  Deno.mkdirSync(outputDir, { recursive: true });
  const newArgs: typeof args.args = (args.args ?? []).map((_arg) => {
    const arg = _arg as string; // we know it's a string, TypeScript doesn't somehow
    if (!arg.startsWith(temp.baseDir)) {
      return arg;
    }
    const newArg = join(outputDir, basename(arg));
    if (arg.match(/^.*quarto\-defaults.*.yml$/)) {
      // we need to correct the defaults YML because it contains a reference to a template in a temp directory
      const ymlDefaults = Deno.readTextFileSync(arg);
      const defaults = parseYml(ymlDefaults);
      const templateDirectory = dirname(defaults.template);
      const newTemplateDirectory = join(
        outputDir,
        basename(templateDirectory),
      );
      copyTo(templateDirectory, newTemplateDirectory);
      defaults.template = join(
        newTemplateDirectory,
        basename(defaults.template),
      );
      const defaultsOutputFile = join(outputDir, basename(arg));
      Deno.writeTextFileSync(defaultsOutputFile, stringify(defaults));
      return defaultsOutputFile;
    }
    Deno.copyFileSync(arg, newArg);
    return newArg;
  });

  // now we need to correct entries in filterParams
  const filterParams = JSON.parse(
    new TextDecoder().decode(decodeBase64(args.env!["QUARTO_FILTER_PARAMS"])),
  );
  walkJson(
    filterParams,
    (v: unknown) => typeof v === "string" && v.startsWith(temp.baseDir),
    (_v: unknown) => {
      const v = _v as string;
      const newV = join(outputDir, basename(v));
      Deno.copyFileSync(v, newV);
      return newV;
    },
  );

  Deno.writeTextFileSync(
    join(outputDir, "render-command.json"),
    JSON.stringify(
      {
        ...args,
        args: newArgs,
        env: {
          ...args.env,
          "QUARTO_FILTER_PARAMS": encodeBase64(JSON.stringify(filterParams)),
        },
      },
      undefined,
      2,
    ),
  );
}

export async function runPandoc(
  options: PandocOptions,
  sysFilters: string[],
): Promise<RunPandocResult | null> {
  const beforePandocHooks: (() => unknown)[] = [];
  const afterPandocHooks: (() => unknown)[] = [];
  const setupPandocHooks = (
    hooks: { before: (() => unknown)[]; after: (() => unknown)[] },
  ) => {
    beforePandocHooks.push(...hooks.before);
    afterPandocHooks.push(...hooks.after);
  };

  const pandocEnv: { [key: string]: string } = {};

  const setupPandocEnv = () => {
    pandocEnv["QUARTO_FILTER_PARAMS"] = encodeBase64(
      JSON.stringify(paramsJson),
    );

    const traceFilters =
      // deno-lint-ignore no-explicit-any
      (pandocMetadata as any)?.["_quarto"]?.["trace-filters"] ||
      Deno.env.get("QUARTO_TRACE_FILTERS");

    if (traceFilters) {
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
    }

    // https://github.com/quarto-dev/quarto-cli/issues/8274
    // do not use the default LUA_CPATH, as it will cause pandoc to
    // load the system lua libraries, which may not be compatible with
    // the lua version we are using
    if (Deno.env.get("QUARTO_LUA_CPATH") !== undefined) {
      pandocEnv["LUA_CPATH"] = getenv("QUARTO_LUA_CPATH");
    } else {
      pandocEnv["LUA_CPATH"] = "";
    }
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
    ...options.format.metadata,
    crossref: {
      ...(options.format.metadata.crossref || {}),
    },
    ...options.flags?.metadata,
  } as Metadata;

  const cleanQuartoTestsMetadata = (metadata: Metadata) => {
    // remove any metadata that is only used for testing
    if (metadata["_quarto"] && typeof metadata["_quarto"] === "object") {
      delete (metadata._quarto as { [key: string]: unknown })?.tests;
      if (Object.keys(metadata._quarto).length === 0) {
        delete metadata._quarto;
      }
    }
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
    removeFilterParams(metadata);

    // Don't print empty reveal-js plugins
    if (
      metadata[kRevealJSPlugins] &&
      (metadata[kRevealJSPlugins] as Array<unknown>).length === 0
    ) {
      delete metadata[kRevealJSPlugins];
    }

    // Don't print _quarto.tests
    // This can cause issue on regex test for printed output
    cleanQuartoTestsMetadata(metadata);

    // Filter out bundled engines from the engines array
    if (Array.isArray(metadata.engines)) {
      const filteredEngines = metadata.engines.filter((engine) => {
        const enginePath = typeof engine === "string" ? engine : engine.path;
        // Keep user engines, filter out bundled ones
        return !enginePath?.replace(/\\/g, "/").includes(
          "resources/extension-subtrees/",
        );
      });

      // Remove the engines key entirely if empty, otherwise assign filtered array
      if (filteredEngines.length === 0) {
        delete metadata.engines;
      } else {
        metadata.engines = filteredEngines;
      }
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
  let printAllDefaults = safeCloneDeep(allDefaults);

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

    // start with the merge
    const inputExtras = mergeConfigs(
      projectExtras,
      formatExtras,
      {
        metadata: projectExtras.metadata?.[kDocumentClass]
          ? {
            [kDocumentClass]: projectExtras.metadata?.[kDocumentClass],
          }
          : undefined,
      },
    );

    const extras = await resolveExtras(
      options.source,
      inputExtras,
      options.format,
      cwd,
      options.libDir,
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
      // Clean up deprecated kHighlightStyle if user used old name
      delete printAllDefaults[kHighlightStyle];
      delete allDefaults[kHighlightStyle];
      if (extras.pandoc[kSyntaxHighlighting] === null) {
        delete printAllDefaults[kSyntaxHighlighting];
        allDefaults[kSyntaxHighlighting] = null;
      } else if (extras.pandoc[kSyntaxHighlighting]) {
        delete printAllDefaults[kSyntaxHighlighting];
        allDefaults[kSyntaxHighlighting] = extras.pandoc[kSyntaxHighlighting];
      } else {
        delete printAllDefaults[kSyntaxHighlighting];
        delete allDefaults[kSyntaxHighlighting];
      }
    }

    // merge metadata
    if (extras.metadata || extras.metadataOverride) {
      // before we merge metadata, ensure that partials are proper paths
      resolveTemplatePartialPaths(
        options.format.metadata,
        cwd,
        options.project,
      );
      options.format.metadata = {
        ...mergeConfigs(
          extras.metadata || {},
          options.format.metadata,
        ),
        ...extras.metadataOverride || {},
      };
      printMetadata = mergeConfigs(extras.metadata || {}, printMetadata);
      cleanMetadataForPrinting(printMetadata);
    }

    // merge notebooks that have been provided by the document / user
    // or by the project as format extras
    if (extras[kNotebooks]) {
      const documentNotebooks = options.format.render[kNotebookView];
      // False means that the user has explicitely disabled notebooks
      if (documentNotebooks !== false) {
        const userNotebooks = documentNotebooks === true
          ? []
          : Array.isArray(documentNotebooks)
          ? documentNotebooks
          : documentNotebooks !== undefined
          ? [documentNotebooks]
          : [];

        // Only add notebooks that aren't already present
        const uniqExtraNotebooks = extras[kNotebooks].filter((nb) => {
          return !userNotebooks.find((userNb) => {
            return userNb.notebook === nb.notebook;
          });
        });

        options.format.render[kNotebookView] = [
          ...userNotebooks,
          ...uniqExtraNotebooks,
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
    options.format.metadata = cleanupPandocMetadata({
      ...options.format.metadata,
    });
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
      if (typeof filter === "string") {
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
  if (isWindows) {
    await cacheCodePage();
  }

  // filter results json file
  const filterResultsFile = options.services.temp.createFile();

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
  );

  setupPandocHooks(
    handleCombinedLuaProfiles(
      options.source,
      paramsJson,
      options.services.temp,
    ),
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
  const pandocMetadata = safeCloneDeep(options.format.metadata || {});
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

      // don't process some format specific metadata that may have been processed already
      // - theme is handled specifically already for revealjs with a metadata override and should not be overridden by user input
      if (key === kTheme && isRevealjsOutput(options.format.pandoc)) {
        continue;
      }
      // - categories are handled specifically already for website projects with a metadata override and should not be overridden by user input
      if (key === kFieldCategories && projectIsWebsite(options.project)) {
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
    assert(format === undefined || typeof format === "string");
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
    assert(typeof citationMetadata === "object");
    // ideally we should be asserting non-arrayness here but that's not very fast.
    // assert(!Array.isArray(citationMetadata));
    const citationMetadataObj = citationMetadata as Record<string, unknown>;
    const docCSLDate = dateRaw
      ? cslDate(resolveDate(options.source, dateRaw))
      : undefined;
    const fields = ["issued", "available-date"];
    fields.forEach((field) => {
      if (citationMetadataObj[field]) {
        citationMetadataObj[field] = cslDate(citationMetadataObj[field]);
      } else if (docCSLDate) {
        citationMetadataObj[field] = docCSLDate;
      }
    });
  }

  // Resolve the author metadata into a form that Pandoc will recognize
  const authorsRaw = pandocMetadata[kAuthors] || pandocMetadata[kAuthor];
  if (authorsRaw) {
    const authors = parseAuthor(pandocMetadata[kAuthor], true);
    if (authors) {
      pandocMetadata[kAuthor] = authors.map((author) =>
        cslNameToString(author.name)
      );
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
    assert(!docClass || typeof docClass === "string");
    const isPrintDocumentClass = docClass &&
      ["book", "scrbook"].includes(docClass as string);

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
  const pandocPassedMetadata = safeCloneDeep(pandocMetadata);
  delete pandocPassedMetadata.format;
  delete pandocPassedMetadata.project;
  delete pandocPassedMetadata.website;
  delete pandocPassedMetadata.about;
  // these shouldn't be visible because they are emitted on markdown output
  // and it breaks ensureFileRegexMatches
  cleanQuartoTestsMetadata(pandocPassedMetadata);

  // Filter out bundled engines from metadata passed to Pandoc
  if (Array.isArray(pandocPassedMetadata.engines)) {
    const filteredEngines = pandocPassedMetadata.engines.filter((engine) => {
      const enginePath = typeof engine === "string" ? engine : engine.path;
      if (!enginePath) return true;
      return !enginePath.replace(/\\/g, "/").includes(
        "resources/extension-subtrees/",
      );
    });

    if (filteredEngines.length === 0) {
      delete pandocPassedMetadata.engines;
    } else {
      pandocPassedMetadata.engines = filteredEngines;
    }
  }

  // Escape @ in book metadata to prevent false citeproc warnings (#12136).
  // Book metadata can't be deleted like website/about because {{< meta book.* >}}
  // shortcodes depend on it. Pandoc resolves &#64; back to @ in the AST.
  if (pandocPassedMetadata.book) {
    pandocPassedMetadata.book = escapeAtInMetadata(pandocPassedMetadata.book);
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

  // run beforePandoc hooks
  for (const hook of beforePandocHooks) {
    await hook();
  }

  setupPandocEnv();

  const params = {
    cmd: cmd[0],
    args: cmd.slice(1),
    cwd,
    env: pandocEnv,
    ourEnv: Deno.env.toObject(),
  };
  const captureCommand = Deno.env.get("QUARTO_CAPTURE_RENDER_COMMAND");
  if (captureCommand) {
    captureRenderCommand(params, options.services.temp, captureCommand);
  }
  const pandocRender = makeTimedFunctionAsync("pandoc-render", async () => {
    return await execProcess(params);
  });

  // run pandoc
  const result = await pandocRender();

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
    if (isWindows) {
      clearCodePageCache();
    }

    return null;
  }
}

// this mutates metadata[kClassOption]
function cleanupPandocMetadata(metadata: Metadata) {
  // pdf classoption can end up with duplicated options
  const classoption = metadata[kClassOption];
  if (Array.isArray(classoption)) {
    metadata[kClassOption] = ld.uniqBy(
      classoption.reverse(),
      (option: string) => {
        return option.replace(/=.+$/, "");
      },
    ).reverse();
  }

  return metadata;
}

async function resolveExtras(
  input: string,
  extras: FormatExtras, // input format extras (project, format, brand)
  format: Format,
  inputDir: string,
  libDir: string,
  dependenciesFile: string,
  project: ProjectContext,
) {
  // resolve format resources
  await writeFormatResources(
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
      format,
      project,
    );

    // resolve dependencies
    await writeDependencies(dependenciesFile, extras);

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

  // perform typst-specific merging
  if (isTypstOutput(format.pandoc)) {
    const brand = (await project.resolveBrand(input))?.light;
    const fontdirs: Set<string> = new Set();
    const base_urls = {
      google: "https://fonts.googleapis.com/css",
      bunny: "https://fonts.bunny.net/css",
    };
    const ttf_urls = [], woff_urls: Array<string> = [];
    if (brand?.data.typography) {
      const fonts = brand.data.typography.fonts || [];
      for (const _font of fonts) {
        // if font lacks a source, we assume google in typst output

        // deno-lint-ignore no-explicit-any
        const source: string = (_font as any).source ?? "google";
        if (source === "file") {
          const font = Zod.BrandFontFile.parse(_font);
          for (const file of font.files || []) {
            const path = typeof file === "object" ? file.path : file;
            fontdirs.add(resolve(dirname(join(brand.brandDir, path))));
          }
        } else if (source === "bunny") {
          const font = Zod.BrandFontBunny.parse(_font);
          console.log(
            "Font bunny is not yet supported for Typst, skipping",
            font.family,
          );
        } else if (source === "google" /* || font.source === "bunny" */) {
          const font = Zod.BrandFontGoogle.parse(_font);
          let { family, style, weight } = font;
          const parts = [family!];
          if (style) {
            style = Array.isArray(style) ? style : [style];
            parts.push(style.join(","));
          }
          if (weight) {
            weight = Array.isArray(weight) ? weight : [weight];
            parts.push(weight.join(","));
          }
          const response = await fetch(
            `${base_urls[source]}?family=${parts.join(":")}`,
          );
          const lines = (await response.text()).split("\n");
          for (const line of lines) {
            const sourcelist = line.match(/^ *src: (.*); *$/);
            if (sourcelist) {
              const sources = sourcelist[1].split(",").map((s) => s.trim());
              let found = false;
              const failed_formats = [];
              for (const source of sources) {
                const match = source.match(
                  /url\(([^)]*)\) *format\('([^)]*)'\)/,
                );
                if (match) {
                  const [_, url, format] = match;
                  if (["truetype", "opentype"].includes(format)) {
                    ttf_urls.push(url);
                    found = true;
                    break;
                  }
                  //  else if (["woff", "woff2"].includes(format)) {
                  //   woff_urls.push(url);
                  //   break;
                  // }
                  failed_formats.push(format);
                }
              }
              if (!found) {
                console.log(
                  "skipping",
                  family,
                  "\nnot currently able to use formats",
                  failed_formats.join(", "),
                );
              }
            }
          }
        }
      }
    }
    if (ttf_urls.length || woff_urls.length) {
      const font_cache = migrateProjectScratchPath(
        brand!.projectDir,
        "typst-font-cache",
        "typst/fonts",
      );
      const url_to_path = (url: string) => url.replace(/^https?:\/\//, "");
      const cached = async (url: string) => {
        const path = url_to_path(url);
        try {
          await Deno.lstat(join(font_cache, path));
          return true;
        } catch (err) {
          if (!(err instanceof Deno.errors.NotFound)) {
            throw err;
          }
          return false;
        }
      };
      const download = async (url: string) => {
        const path = url_to_path(url);
        await ensureDir(
          join(font_cache, dirname(path)),
        );

        const response = await fetch(url);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        await Deno.writeFile(join(font_cache, path), bytes);
      };
      const woff2ttf = async (url: string) => {
        const path = url_to_path(url);
        await call("ttx", { args: [join(font_cache, path)] });
        await call("ttx", {
          args: [join(font_cache, path.replace(/woff2?$/, "ttx"))],
        });
      };
      const ttf_urls2: Array<string> = [], woff_urls2: Array<string> = [];
      await Promise.all(ttf_urls.map(async (url) => {
        if (!await cached(url)) {
          ttf_urls2.push(url);
        }
      }));

      await woff_urls.reduce((cur, next) => {
        return cur.then(() => woff2ttf(next));
      }, Promise.resolve());
      // await Promise.all(woff_urls.map(async (url) => {
      //   if (!await cached(url)) {
      //     woff_urls2.push(url);
      //   }
      // }));
      await Promise.all(ttf_urls2.concat(woff_urls2).map(download));
      if (woff_urls2.length) {
        await Promise.all(woff_urls2.map(woff2ttf));
      }
      fontdirs.add(font_cache);
    }
    let fontPaths = format.metadata[kFontPaths] as Array<string> || [];
    if (typeof fontPaths === "string") {
      fontPaths = [fontPaths];
    }
    fontPaths = fontPaths.map((path) =>
      path[0] === "/" ? join(project.dir, path) : path
    );
    fontPaths.push(...fontdirs);
    format.metadata[kFontPaths] = fontPaths;
  }

  // Process format resources

  // If we're generating the PDF, we can move the format resources once the pandoc
  // render has completed.
  if (format.render[kLatexAutoMk] === false) {
    // Process the format resouces right here on the spot
    await processFormatResources(inputDir, dependenciesFile);
  } else {
    const resourceDependenciesPostProcessor = async (_output: string) => {
      return await processFormatResources(inputDir, dependenciesFile);
    };
    extras.postprocessors = extras.postprocessors || [];
    extras.postprocessors.push(resourceDependenciesPostProcessor);
  }

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
    const printMetadata = safeCloneDeep(metadata);
    delete printMetadata.format;

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
  extras = {
    ...extras,
    pandoc: extras.pandoc ? { ...extras.pandoc } : {},
  } as FormatExtras;

  // Get the user selected theme or choose a default
  // Check both syntax-highlighting (new) and highlight-style (deprecated alias)
  const highlightTheme = pandoc[kSyntaxHighlighting] ||
    pandoc[kHighlightStyle] ||
    kDefaultHighlightStyle;
  const textHighlightingMode = extras.html?.[kTextHighlightingMode];

  if (highlightTheme === "none") {
    // Disable highlighting - pass "none" string (not null, which Pandoc 3.8+ rejects)
    extras.pandoc = extras.pandoc || {};
    extras.pandoc[kSyntaxHighlighting] = "none";
    return extras;
  }

  if (highlightTheme === "idiomatic") {
    if (isRevealjsOutput(pandoc)) {
      // reveal.js idiomatic mode doesn't produce working highlighting
      // Fall through to default skylighting instead
      warning(
        "syntax-highlighting: idiomatic is not supported for reveal.js. Using default highlighting.",
      );
    } else {
      // Use native format highlighting (typst native, LaTeX listings)
      // Pass through to Pandoc 3.8+ which handles this natively
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kSyntaxHighlighting] = "idiomatic";
      return extras;
    }
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
      extras.pandoc[kSyntaxHighlighting] = textHighlightThemePath(
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
        extras.pandoc[kSyntaxHighlighting] = textHighlightThemePath(
          inputDir,
          "none",
        );
      }
      break;
    case undefined:
    default:
      // Set the the light (default) highlighting mode
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kSyntaxHighlighting] =
        textHighlightThemePath(inputDir, highlightTheme, "light") ||
        highlightTheme;
      break;
  }
  return extras;
}

// deno-lint-ignore no-explicit-any
function escapeAtInMetadata(value: any): any {
  if (typeof value === "string") {
    return isExternalPath(value) ? value.replaceAll("@", "&#64;") : value;
  }
  if (Array.isArray(value)) {
    return value.map(escapeAtInMetadata);
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = escapeAtInMetadata(v);
    }
    return result;
  }
  return value;
}
