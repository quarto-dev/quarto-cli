/*
* pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { info } from "log/mod.ts";

import { ensureDirSync } from "fs/mod.ts";

import { stringify } from "encoding/yaml.ts";

import { ld } from "lodash/mod.ts";

import { Document } from "deno_dom/deno-dom-wasm.ts";

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
  kSassBundles,
  kTextHighlightingMode,
} from "../../config/types.ts";
import { isHtmlOutput, isLatexOutput } from "../../config/format.ts";
import { isQuartoMetadata, metadataGetDeep } from "../../config/metadata.ts";
import {
  binaryPath,
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

import { removePandocArgs } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { filterParamsJson, removeFilterParmas } from "./filters.ts";
import {
  kClassOption,
  kDocumentClass,
  kFilterParams,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kKeepSource,
  kMetadataFormat,
  kNumberOffset,
  kNumberSections,
  kPageTitle,
  kQuartoVarsKey,
  kResources,
  kTitle,
  kTitlePrefix,
  kTocTitle,
  kVariables,
} from "../../config/constants.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { discoverResourceRefs } from "../../core/html.ts";

import {
  kDefaultHighlightStyle,
  kMarkdownBlockSeparator,
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
import { parsePandocTitle } from "../../core/pandoc/pandoc-partition.ts";

export async function runPandoc(
  options: PandocOptions,
  sysFilters: string[],
): Promise<RunPandocResult | null> {
  // compute cwd for render
  const cwd = dirname(options.source);

  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [binaryPath("pandoc")];

  // build command line args
  const args = [...options.args];

  // propagate quiet
  if (options.flags?.quiet) {
    args.push("--quiet");
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

  // see if there are extras
  const htmlPostprocessors: Array<(doc: Document) => Promise<string[]>> = [];
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

    // provide default toc-title if necessary
    if (extras[kTocTitle]) {
      options.format.metadata[kTocTitle] = extras[kTocTitle];
    }

    // merge sysFilters if we have them
    if (sysFilters.length > 0) {
      extras.filters = extras.filters || {};
      extras.filters.post = extras.filters.post || [];
      extras.filters.post.unshift(
        ...(sysFilters.map((filter) => resourcePath(join("filters", filter)))),
      );
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
      options.format.metadata = mergeConfigs(
        extras.metadata,
        options.format.metadata,
      );
      printMetadata = mergeConfigs(extras.metadata, printMetadata);
      cleanMetadataForPrinting(printMetadata);
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
  const titlePrefix = allDefaults?.[kVariables]?.[kTitlePrefix] ||
    options.format.metadata[kTitlePrefix];

  // provide default page title if necessary
  if (!title && !pageTitle) {
    const [_dir, stem] = dirAndStem(options.source);
    args.push(
      "--metadata",
      `pagetitle:${pandocAutoIdentifier(stem, false)}`,
    );
  }

  // don't ever duplicate title and title-prefix
  if (title === titlePrefix) {
    delete allDefaults?.[kVariables]?.[kTitlePrefix];
    delete options.format.metadata[kTitlePrefix];
  }

  // determine path to crossref file

  // set parameters required for filters (possibily mutating all of it's arguments
  // to pull includes out into quarto parameters so they can be merged)
  const paramsJson = filterParamsJson(
    args,
    options,
    allDefaults,
    formatFilterParams,
  );

  // remove selected args and defaults if we are handling some things on behalf of pandoc
  // (e.g. handling section numbering). note that section numbering is handled by the
  // crossref filter so we only do this if the user hasn't disabled the crossref filter
  let pandocArgs = args;
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

  // append keep-source (if requested) + the metadata to the file (this is so that
  // our fully resolved metadata, which incorporates project and format-specific
  // values, overrides the metadata contained within the file).

  const input = markdown +
    keepSourceBlock(options.format, options.source) +
    kMarkdownBlockSeparator +
    `\n---\n${
      stringify(pandocMetadata, {
        indent: 2,
        sortKeys: false,
        skipInvalid: true,
      })
    }\n---\n`;

  // write input to temp file and pass it to pandoc
  const inputTemp = sessionTempFile({ prefix: "quarto-input", suffix: ".md" });
  Deno.writeTextFileSync(inputTemp, input);
  cmd.push(inputTemp);

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
  if (result.success) {
    return {
      resources,
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

  // project default toc title always wins
  if (projectExtras[kTocTitle]) {
    extras[kTocTitle] = projectExtras[kTocTitle];
  }

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

    // Set the highlighting theme (if any)
    extras.pandoc = extras.pandoc || {};
    extras = resolveTextHighlightStyle(
      extras,
      format.pandoc,
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
    for (const dependency of extras.html?.[kDependencies]!) {
      const dir = dependency.version
        ? `${dependency.name}-${dependency.version}`
        : dependency.name;
      const targetDir = join(inputDir, libDir, dir);
      // deno-lint-ignore no-explicit-any
      const copyDep = (
        file: DependencyFile,
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
