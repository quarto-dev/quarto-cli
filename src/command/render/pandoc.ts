/*
* pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { info } from "log/mod.ts";

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { stringify } from "encoding/yaml.ts";

import { ld } from "lodash/mod.ts";

import { Document } from "deno_dom/deno-dom-wasm-noinit.ts";

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
  kHtmlPostprocessors,
  kMarkdownAfterBody,
  kSassBundles,
  kTemplatePatches,
  kTextHighlightingMode,
} from "../../config/types.ts";
import { isHtmlOutput, isLatexOutput } from "../../config/format.ts";
import { isQuartoMetadata, metadataGetDeep } from "../../config/metadata.ts";
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
  kClassOption,
  kColorLinks,
  kDocumentClass,
  kFilterParams,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepSource,
  kLang,
  kLinkColor,
  kMetadataFormat,
  kNumberOffset,
  kNumberSections,
  kPageTitle,
  kQuartoVarsKey,
  kResources,
  kTemplate,
  kTitle,
  kTitlePrefix,
  kTocTitle,
  kTocTitleDocument,
  kTocTitleWebsite,
  kVariables,
} from "../../config/constants.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { discoverResourceRefs } from "../../core/html.ts";

import {
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
import {
  readDefaultLanguageTranslations,
  translationsForLang,
} from "../../core/language.ts";

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

  // start with system defaults for the current language
  const langCode = (options.format.metadata[kLang] as string | undefined) ||
    "en";
  const language = readDefaultLanguageTranslations(langCode);
  // merge any user provided language w/ the defaults
  options.format.language = mergeConfigs(
    language,
    options.format.language || {},
  );

  // now select the correct variations based on the lang code and translations
  options.format.language = translationsForLang(
    options.format.language,
    langCode,
  );

  // if there is no toc title then provide the appropirate default
  if (!options.format.metadata[kTocTitle]) {
    options.format.metadata[kTocTitle] = options.format.language[
      projectIsWebsite(options.project) ? kTocTitleWebsite : kTocTitleDocument
    ];
  }

  // see if there are extras
  const postprocessors: Array<(output: string) => Promise<void>> = [];
  const htmlPostprocessors: Array<
    (doc: Document) => Promise<string[]>
  > = [];
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
      ))
      : {};

    const formatExtras = options.format.formatExtras
      ? (await options.format.formatExtras(
        options.source,
        options.flags || {},
        options.format,
        options.libDir,
      ))
      : {};

    const extras = await resolveExtras(
      projectExtras,
      formatExtras,
      options.format,
      cwd,
      options.libDir,
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

    // add a post-processor for fixing overflow-x in cell output display
    if (isHtmlOutput(options.format.pandoc, true)) {
      htmlPostprocessors.push(selectInputPostprocessor);
    }

    // add a resource discovery postProcessor if we are not in a website project
    if (!projectIsWebsite(options.project)) {
      htmlPostprocessors.push(discoverResourceRefs);
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
          ...extras[kIncludeAfterBody] || [],
          ...allDefaults[kIncludeAfterBody] || [],
        ],
      };
    }

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
  const filterResultsFile = sessionTempFile();

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

  // write the defaults file
  if (allDefaults) {
    const defaultsFile = await writeDefaultsFile(allDefaults);
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

    if (!isQuartoMetadata(key) && !isChapterTitle) {
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
      ? markdown + "\n" + htmlRenderAfterBody.join("\n")
      : markdown;

  // append render after + keep-source if requested
  const input = markdownWithRenderAfter +
    keepSourceBlock(options.format, options.source);

  // write input to temp file and pass it to pandoc
  const inputTemp = sessionTempFile({ prefix: "quarto-input", suffix: ".md" });
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
  const metadataTemp = sessionTempFile({
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
  if (!options.flags?.quiet && options.format.metadata) {
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
        "QUARTO_FILTER_PARAMS": paramsJson,
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
      formatExtras.html?.[kSassBundles],
      projectExtras.html?.[kSassBundles],
      project,
    );

    // resolve dependencies
    extras = resolveDependencies(extras, inputDir, libDir);

    // body envelope to includes (project body envelope always wins)
    if (extras.html?.[kBodyEnvelope] && projectExtras.html?.[kBodyEnvelope]) {
      extras.html[kBodyEnvelope] = projectExtras.html[kBodyEnvelope];
    }
    extras = resolveBodyEnvelope(extras);
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
    `<link href="<%- href %>" rel="<%- rel %>" />`,
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
    const dependenciesHead = sessionTempFile({
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

function resolveBodyEnvelope(extras: FormatExtras) {
  // deep copy to not mutate caller's object
  extras = ld.cloneDeep(extras);

  const envelope = extras.html?.[kBodyEnvelope];
  if (envelope) {
    const writeBodyFile = (
      type: "include-in-header" | "include-before-body" | "include-after-body",
      content?: string,
    ) => {
      if (content) {
        const file = sessionTempFile({ suffix: ".html" });
        Deno.writeTextFileSync(file, content);
        if (type === kIncludeAfterBody) {
          extras[type] = (extras[type] || []).concat(file);
        } else {
          extras[type] = [file].concat(extras[type] || []);
        }
      }
    };
    writeBodyFile(kIncludeInHeader, envelope.header);
    writeBodyFile(kIncludeBeforeBody, envelope.before);
    writeBodyFile(kIncludeAfterBody, envelope.after);

    delete extras.html?.[kBodyEnvelope];
  }

  return extras;
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
