/*
* pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { info } from "log/mod.ts";

import { ensureDirSync, existsSync, expandGlobSync } from "fs/mod.ts";

import { stringify } from "encoding/yaml.ts";
import { encode as base64Encode } from "encoding/base64.ts";

import * as ld from "../../core/lodash.ts";

import { Document } from "../../core/deno-dom.ts";

import { execProcess } from "../../core/process.ts";
import { dirAndStem, pathWithForwardSlashes } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";

import {
  DependencyFile,
  Format,
  FormatExtras,
  FormatPandoc,
  kBodyEnvelope,
  kDependencies,
  kHtmlFinalizers,
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  kTemplatePatches,
  kTextHighlightingMode,
} from "../../config/types.ts";
import {
  isEpubOutput,
  isHtmlDocOutput,
  isHtmlFileOutput,
  isHtmlOutput,
  isLatexOutput,
} from "../../config/format.ts";
import {
  isIncludeMetadata,
  isQuartoMetadata,
  metadataGetDeep,
} from "../../config/metadata.ts";
import {
  pandocBinaryPath,
  resourcePath,
  textHighlightThemePath,
} from "../../core/resources.ts";
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
} from "../../project/project-context.ts";
import { deleteCrossrefMetadata } from "../../project/project-crossrefs.ts";

import { havePandocArg, removePandocArgs } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { filterParamsJson, removeFilterParmas } from "./filters.ts";
import {
  kAbstract,
  kAbstractTitle,
  kClassOption,
  kColorLinks,
  kDocumentClass,
  kFigResponsive,
  kFilterParams,
  kFrom,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepSource,
  kLinkColor,
  kMetadataFormat,
  kNumberOffset,
  kNumberSections,
  kPageTitle,
  kQuartoVarsKey,
  kResources,
  kSectionTitleAbstract,
  kSyntaxDefinitions,
  kTemplate,
  kTitle,
  kTitlePrefix,
  kTocTitle,
  kTocTitleDocument,
  kTocTitleWebsite,
  kVariables,
} from "../../config/constants.ts";
import { TempContext } from "../../core/temp.ts";
import { discoverResourceRefs } from "../../core/html.ts";

import {
  HtmlPostProcessResult,
  kDefaultHighlightStyle,
  PandocOptions,
  RunPandocResult,
} from "./types.ts";
import { crossrefFilterActive } from "./crossref.ts";
import { selectInputPostprocessor } from "./layout.ts";
import {
  codeToolsPostprocessor,
  formatHasCodeTools,
  keepSourceBlock,
} from "./codetools.ts";
import { pandocMetadataPath } from "./render-shared.ts";
import { Metadata } from "../../config/types.ts";
import { resourcesFromMetadata } from "./resources.ts";
import { resolveSassBundles } from "./pandoc-html.ts";
import { patchHtmlTemplate } from "./output.ts";
import { formatLanguage } from "../../core/language.ts";
import {
  pandocFormatWith,
  splitPandocFormatString,
} from "../../core/pandoc/pandoc-formats.ts";

export async function runPandoc(
  options: PandocOptions,
  sysFilters: string[],
): Promise<RunPandocResult | null> {
  // compute cwd for render
  const cwd = dirname(options.source);

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [pandocBinaryPath()];

  // build command line args
  const args = [...options.args];

  // propagate quiet
  if (options.flags?.quiet) {
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
    delete metadata[kQuartoVarsKey];
    delete metadata[kFigResponsive];
    deleteProjectMetadata(metadata);
    deleteCrossrefMetadata(metadata);
  };
  cleanMetadataForPrinting(printMetadata);

  // generate defaults and capture defaults to be printed
  let allDefaults = await generateDefaults(options) || {};
  let printAllDefaults = ld.cloneDeep(allDefaults) as FormatPandoc;

  // capture any filterParams in the FormatExtras
  const formatFilterParams = {} as Record<string, unknown>;

  // the "ojs" filter is a special value that results in us
  // just signaling our standard filter chain that the ojs
  // filter should be active
  const kOJSFilter = "ojs";
  if (sysFilters.includes(kOJSFilter)) {
    formatFilterParams[kOJSFilter] = true;
    sysFilters = sysFilters.filter((filter) => filter !== kOJSFilter);
  }

  // now that 'lang' is resolved we can determine our actual language values
  options.format.language = await formatLanguage(
    options.format.metadata,
    options.format.language,
    options.flags,
  );

  // if there is no toc title then provide the appropirate default
  if (!options.format.metadata[kTocTitle]) {
    options.format.metadata[kTocTitle] = options.format.language[
      (projectIsWebsite(options.project) && !projectIsBook(options.project) &&
          isHtmlOutput(options.format.pandoc, true))
        ? kTocTitleWebsite
        : kTocTitleDocument
    ];
  }

  // if there is an abtract then forward abtract-title
  if (
    options.format.metadata[kAbstract] &&
    (isHtmlDocOutput(options.format.pandoc) ||
      isEpubOutput(options.format.pandoc))
  ) {
    options.format.metadata[kAbstractTitle] =
      options.format.language[kSectionTitleAbstract];
  }

  // see if there are extras
  const postprocessors: Array<(output: string) => Promise<void>> = [];
  const htmlPostprocessors: Array<
    (doc: Document) => Promise<HtmlPostProcessResult>
  > = [];
  const htmlFinalizers: Array<(doc: Document) => Promise<void>> = [];
  const htmlRenderAfterBody: string[] = [];
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
        options.temp,
      ))
      : {};

    const formatExtras = options.format.formatExtras
      ? (await options.format.formatExtras(
        options.source,
        options.flags || {},
        options.format,
        options.libDir,
        options.temp,
      ))
      : {};

    const extras = await resolveExtras(
      projectExtras,
      formatExtras,
      options.format,
      cwd,
      options.libDir,
      options.temp,
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

    // add a post-processor for fixing overflow-x in cell output display
    if (isHtmlFileOutput(options.format.pandoc)) {
      htmlPostprocessors.push(selectInputPostprocessor);

      // add a resource discovery postProcessor if we are not in a website project
      if (!projectIsWebsite(options.project)) {
        htmlPostprocessors.push(discoverResourceRefs);
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
      if (extras.pandoc[kHighlightStyle]) {
        delete printAllDefaults[kHighlightStyle];
        allDefaults[kHighlightStyle] = extras.pandoc[kHighlightStyle];
      }
    }

    // merge metadata
    if (extras.metadata) {
      options.format.metadata = {
        ...mergeConfigs(
          extras.metadata,
          options.format.metadata,
        ),
        ...extras.metadataOverride,
      };
      printMetadata = mergeConfigs(extras.metadata, printMetadata);
      cleanMetadataForPrinting(printMetadata);
    }

    // patch template (if its a built-in pandoc template)
    if (!allDefaults[kTemplate] && !havePandocArg(args, "--template")) {
      if (allDefaults.to && isHtmlOutput(allDefaults.to)) {
        allDefaults[kTemplate] = await patchHtmlTemplate(
          allDefaults.to,
          options.format,
          options.temp,
          extras.html?.[kTemplatePatches],
          options.flags,
        );
      }
    }

    // more cleanup
    options.format.metadata = cleanupPandocMetadata(options.format.metadata);
    printMetadata = cleanupPandocMetadata(printMetadata);

    if (extras[kIncludeInHeader]) {
      allDefaults = {
        ...allDefaults,
        [kIncludeInHeader]: [
          ...extras[kIncludeInHeader] || [],
          ...allDefaults[kIncludeInHeader] || [],
        ],
      };
    }
    if (extras[kIncludeBeforeBody]) {
      allDefaults = {
        ...allDefaults,
        [kIncludeBeforeBody]: [
          ...extras[kIncludeBeforeBody] || [],
          ...allDefaults[kIncludeBeforeBody] || [],
        ],
      };
    }
    if (extras[kIncludeAfterBody]) {
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
    resolveBodyEnvelope(allDefaults, extras, options.temp);

    // add any filters
    allDefaults.filters = [
      ...extras.filters?.pre || [],
      ...allDefaults.filters || [],
      ...extras.filters?.post || [],
    ];

    // make the filter paths windows safe
    allDefaults.filters = allDefaults.filters.map(pandocMetadataPath);

    // Capture any format filter params
    const filterParams = extras[kFilterParams];
    if (filterParams) {
      Object.keys(filterParams).forEach((key) => {
        formatFilterParams[key] = filterParams[key];
      });
    }
  }

  // resolve some title variables
  const title = allDefaults?.[kVariables]?.[kTitle] ||
    options.format.metadata[kTitle];
  const pageTitle = allDefaults?.[kVariables]?.[kPageTitle] ||
    options.format.metadata[kPageTitle];
  const titlePrefix = allDefaults?.[kTitlePrefix];

  // provide default page title if necessary
  if (!title && !pageTitle) {
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

  // filter results json file
  const filterResultsFile = options.temp.createFile();

  // set parameters required for filters (possibily mutating all of it's arguments
  // to pull includes out into quarto parameters so they can be merged)
  let pandocArgs = args;
  const paramsJson = filterParamsJson(
    pandocArgs,
    options,
    allDefaults,
    formatFilterParams,
    filterResultsFile,
  );

  // remove selected args and defaults if we are handling some things on behalf of pandoc
  // (e.g. handling section numbering). note that section numbering is handled by the
  // crossref filter so we only do this if the user hasn't disabled the crossref filter
  if (!isLatexOutput(options.format.pandoc) && crossrefFilterActive(options)) {
    delete allDefaults[kNumberSections];
    delete allDefaults[kNumberOffset];
    const removeArgs = new Map<string, boolean>();
    removeArgs.set("--number-sections", false);
    removeArgs.set("--number-offset", true);
    pandocArgs = removePandocArgs(pandocArgs, removeArgs);
  }

  // add any built-in syntax defintiion files
  allDefaults[kSyntaxDefinitions] = allDefaults[kSyntaxDefinitions] || [];
  const syntaxDefinitions = expandGlobSync(
    join(resourcePath(join("pandoc", "syntax-definitions")), "*.xml"),
  );
  for (const syntax of syntaxDefinitions) {
    allDefaults[kSyntaxDefinitions]?.push(syntax.path);
  }

  // write the defaults file
  if (allDefaults) {
    const defaultsFile = await writeDefaultsFile(allDefaults, options.temp);
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

  // If there are no specified options for link coloring in PDF, set them
  // do not color links for obviously printed book output
  if (isLatexOutput(options.format.pandoc)) {
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
  const inputTemp = options.temp.createFile({
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
  const metadataTemp = options.temp.createFile({
    prefix: "quarto-metadata",
    suffix: ".yml",
  });
  Deno.writeTextFileSync(
    metadataTemp,
    stringify(pandocMetadata, {
      indent: 2,
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

  // run pandoc
  const result = await execProcess(
    {
      cmd,
      cwd,
      env: {
        "QUARTO_FILTER_PARAMS": base64Encode(paramsJson),
      },
    },
  );

  // resolve resource files from metadata
  const resources: string[] = resourcesFromMetadata(
    options.format.metadata[kResources],
  );

  // read any resourceFiles generated by filters
  if (existsSync(filterResultsFile)) {
    const filterResultsJSON = Deno.readTextFileSync(filterResultsFile);
    if (filterResultsJSON.trim().length > 0) {
      const filterResults = JSON.parse(filterResultsJSON);
      resources.push(...(filterResults.resourceFiles || []));
    }
  }

  if (result.success) {
    return {
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
  project?: ProjectContext,
) {
  // start with the merge
  let extras = mergeConfigs(projectExtras, formatExtras);

  // project documentclass always wins
  if (projectExtras.metadata?.[kDocumentClass]) {
    extras.metadata = extras.metadata || {};
    extras.metadata[kDocumentClass] = projectExtras.metadata?.[kDocumentClass];
  }

  // perform html-specific merging
  if (isHtmlOutput(format.pandoc)) {
    // resolve sass bundles
    extras = await resolveSassBundles(
      extras,
      format.pandoc,
      temp,
      formatExtras.html?.[kSassBundles],
      projectExtras.html?.[kSassBundles],
      project,
    );

    // resolve dependencies
    extras = resolveDependencies(extras, inputDir, libDir, temp);
  } else {
    delete extras.html;
  }

  // Resolve the highlighting theme (if any)
  extras = resolveTextHighlightStyle(
    extras,
    format.pandoc,
  );

  return extras;
}

export function resolveDependencies(
  extras: FormatExtras,
  inputDir: string,
  libDir: string,
  temp: TempContext,
) {
  // deep copy to not mutate caller's object
  extras = ld.cloneDeep(extras);

  // resolve dependencies
  const metaTemplate = ld.template(
    `<meta name="<%- name %>" content="<%- value %>"/>`,
  );
  const scriptTemplate = ld.template(
    `<script <%= attribs %> src="<%- href %>"></script>`,
  );
  const stylesheetTempate = ld.template(
    `<link <%= attribs %> href="<%- href %>" rel="stylesheet" />`,
  );
  const rawLinkTemplate = ld.template(
    `<link href="<%- href %>" rel="<%- rel %>"<% if (type) { %> type="<%- type %>"<% } %> />`,
  );

  const lines: string[] = [];
  if (extras.html?.[kDependencies]) {
    const copiedDependencies: string[] = [];
    for (const dependency of extras.html?.[kDependencies]!) {
      // Ensure that we copy (and render HTML for) each named dependency only once
      if (copiedDependencies.includes(dependency.name)) {
        continue;
      }

      const dir = dependency.version
        ? `${dependency.name}-${dependency.version}`
        : dependency.name;
      const targetDir = join(inputDir, libDir, dir);
      const copyDep = (
        file: DependencyFile,
        // deno-lint-ignore no-explicit-any
        template?: any,
      ) => {
        const targetPath = join(targetDir, file.name);
        ensureDirSync(dirname(targetPath));
        Deno.copyFileSync(file.path, targetPath);
        if (template) {
          const attribs = file.attribs
            ? Object.entries(file.attribs).map((entry) => {
              const attrib = `${entry[0]}="${entry[1]}"`;
              return attrib;
            }).join(" ")
            : "";
          const href = join(libDir, dir, file.name);
          lines.push(
            template({ href: pathWithForwardSlashes(href), attribs }),
          );
        }
      };
      if (dependency.meta) {
        Object.keys(dependency.meta).forEach((name) => {
          lines.push(metaTemplate({ name, value: dependency.meta![name] }));
        });
      }
      if (dependency.scripts) {
        dependency.scripts.forEach((script) => copyDep(script, scriptTemplate));
      }
      if (dependency.stylesheets) {
        dependency.stylesheets.forEach((stylesheet) => {
          copyDep(
            stylesheet,
            stylesheetTempate,
          );
        });
      }
      if (dependency.links) {
        dependency.links.forEach((link) => {
          if (!link.type) {
            link.type = "";
          }
          lines.push(rawLinkTemplate(link));
        });
      }
      if (dependency.resources) {
        dependency.resources.forEach((resource) => copyDep(resource));
      }

      // Note that we've copied this dependency
      copiedDependencies.push(dependency.name);
    }
    delete extras.html?.[kDependencies];

    // write to external file
    const dependenciesHead = temp.createFile({
      prefix: "dependencies",
      suffix: ".html",
    });
    Deno.writeTextFileSync(dependenciesHead, lines.join("\n"));
    extras[kIncludeInHeader] = [dependenciesHead].concat(
      extras[kIncludeInHeader] || [],
    );
  }

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
    removeFilterParmas(printMetadata);
    // print message
    if (Object.keys(printMetadata).length > 0) {
      info("metadata", { bold: true });
      info(
        stringify(printMetadata, {
          indent: 2,
          sortKeys: false,
          skipInvalid: true,
        }),
        { indent: 2 },
      );
    }
  }
}

function resolveTextHighlightStyle(
  extras: FormatExtras,
  pandoc: FormatPandoc,
): FormatExtras {
  extras = ld.cloneDeep(extras);

  // Get the user selected theme or choose a default
  const highlightTheme = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  const textHighlightingMode = extras.html?.[kTextHighlightingMode];

  // create the possible name matches based upon the dark vs. light
  // and find a matching theme file
  // Themes from
  // https://invent.kde.org/frameworks/syntax-highlighting/-/tree/master/data/themes
  switch (textHighlightingMode) {
    case "light":
    case "dark":
      // Set light or dark mode as appropriate
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kHighlightStyle] =
        textHighlightThemePath(highlightTheme, textHighlightingMode) ||
        highlightTheme;

      break;
    case "none":
      // Clear the highlighting
      delete pandoc[kHighlightStyle];
      if (extras.pandoc) {
        delete extras.pandoc[kHighlightStyle];
      }
      break;
    case undefined:
    default:
      // Set the the light (default) highlighting mode
      extras.pandoc = extras.pandoc || {};
      extras.pandoc[kHighlightStyle] =
        textHighlightThemePath(highlightTheme, "light") ||
        highlightTheme;
      break;
  }
  return extras;
}
