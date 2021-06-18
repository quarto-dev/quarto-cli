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

import { Document } from "deno_dom/deno-dom-wasm.ts";

import { execProcess } from "../../core/process.ts";
import { dirAndStem, pathWithForwardSlashes } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";

import {
  DependencyFile,
  Format,
  FormatExtras,
  FormatPandoc,
  isHtmlOutput,
  isLatexOutput,
  kBodyEnvelope,
  kDependencies,
  kHtmlPostprocessors,
  kSassBundles,
  kTextHighlightingMode,
  SassBundle,
} from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { binaryPath, resourcePath } from "../../core/resources.ts";
import { pandocAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";
import { partitionYamlFrontMatter } from "../../core/yaml.ts";

import {
  deleteProjectMetadata,
  ProjectContext,
} from "../../project/project-context.ts";
import { deleteCrossrefMetadata } from "../../project/project-crossrefs.ts";

import { removePandocArgs, RenderFlags } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { filterParamsJson, removeFilterParmas } from "./filters.ts";
import {
  kDocumentClass,
  kFilterParams,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
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
import { cssImports, cssResources } from "../../core/css.ts";

import { RunPandocResult } from "./render.ts";
import { compileSass } from "./sass.ts";
import { crossrefFilterActive } from "./crossref.ts";
import { kQuartoHtmlDependency } from "../../format/html/format-html.ts";

// options required to run pandoc
export interface PandocOptions {
  // markdown input
  markdown: string;

  // original source file
  source: string;

  // output file that will be written
  output: string;

  // lib dir for converstion
  libDir: string;

  // target format
  format: Format;
  // command line args for pandoc
  args: string[];

  // optoinal project context
  project?: ProjectContext;

  // command line flags (e.g. could be used
  // to specify e.g. quiet or pdf engine)
  flags?: RenderFlags;

  // optional offset from file to project dir
  offset?: string;
}

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

    // save post-processors
    htmlPostprocessors.push(...(extras.html?.[kHtmlPostprocessors] || []));

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
  const markdown = partitionYamlFrontMatter(options.markdown)?.markdown ||
    options.markdown;

  // read the input file then append the metadata to the file (this is to that)
  // our fully resolved metadata, which incorporates project and format-specific
  // values, overrides the metadata contained within the file). we'll feed the
  // input to pandoc on stdin
  const input = markdown +
    "\n\n<!-- -->\n" +
    `\n---\n${
      stringify(options.format.metadata || {}, {
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
  const resources: string[] = [];
  if (options.format.metadata[kResources]) {
    const files = options.format.metadata[kResources];
    if (Array.isArray(files)) {
      for (const file of files) {
        resources.push(String(file));
      }
    } else {
      resources.push(String(files));
    }
  }

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

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
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
      formatExtras.html?.[kSassBundles],
      projectExtras.html?.[kSassBundles],
      project,
    );

    // Set the highlighting theme
    extras.pandoc = extras.pandoc || {};
    extras.pandoc[kHighlightStyle] = textHighlightStyle(
      extras,
      format.pandoc,
    );

    extras = await resolveTextHighlightingCssVariables(extras);

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

function resolveDependencies(
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
  const scriptTemplate = ld.template(`<script src="<%- href %>"></script>`);
  const stylesheetTempate = ld.template(
    `<link href="<%- href %>" rel="stylesheet" />`,
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
      const copyDep = (file: DependencyFile, template?: any) => {
        const targetPath = join(targetDir, file.name);
        ensureDirSync(dirname(targetPath));
        Deno.copyFileSync(file.path, targetPath);
        if (template) {
          const href = join(libDir, dir, file.name);
          lines.push(template({ href: pathWithForwardSlashes(href) }));
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
        dependency.stylesheets.forEach((stylesheet) =>
          copyDep(stylesheet, stylesheetTempate)
        );
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

async function resolveSassBundles(
  extras: FormatExtras,
  formatBundles?: SassBundle[],
  projectBundles?: SassBundle[],
  project?: ProjectContext,
) {
  extras = ld.cloneDeep(extras);

  const mergedBundles: Record<string, SassBundle[]> = {};
  const group = (
    bundles: SassBundle[],
    groupedBundles: Record<string, SassBundle[]>,
  ) => {
    bundles.forEach((bundle) => {
      if (!groupedBundles[bundle.dependency]) {
        groupedBundles[bundle.dependency] = [];
      }
      groupedBundles[bundle.dependency].push(bundle);
    });
  };
  if (projectBundles) {
    group(projectBundles, mergedBundles);
  }

  if (formatBundles) {
    group(formatBundles, mergedBundles);
  }

  // Go through and compile the cssPath for each dependency
  for (const dependency of Object.keys(mergedBundles)) {
    // compile the cssPath
    const bundles = mergedBundles[dependency];
    const cssPath = await compileSass(bundles);
    const cssName = `${dependency}.min.css`;

    // look for a sentinel 'dark' value and note it
    extras.html = extras.html || {};
    if (!extras.html[kTextHighlightingMode]) {
      extras.html[kTextHighlightingMode] = hasDarkSentinel(cssPath)
        ? "dark"
        : "light";
    }

    // Find any imported stylesheets or url references
    // (These could come from user scss that is merged into our theme, for example)
    const css = Deno.readTextFileSync(cssPath);
    const toDependencies = (paths: string[]) => {
      return paths.map((path) => {
        return {
          name: path,
          path: project ? join(project.dir, path) : path,
        };
      });
    };
    const resources = toDependencies(cssResources(css));
    const imports = toDependencies(cssImports(css));

    // Push the compiled Css onto the dependency
    const extraDeps = extras.html?.[kDependencies];

    if (extraDeps) {
      const existingDependency = extraDeps.find((extraDep) =>
        extraDep.name === dependency
      );

      if (existingDependency) {
        if (!existingDependency.stylesheets) {
          existingDependency.stylesheets = [];
        }
        existingDependency.stylesheets.push({
          name: cssName,
          path: cssPath,
        });

        // Add any css references
        existingDependency.stylesheets.push(...imports);
        existingDependency.resources?.push(...resources);
      } else {
        extraDeps.push({
          name: dependency,
          stylesheets: [{
            name: cssName,
            path: cssPath,
          }, ...imports],
          resources,
        });
      }
    }
  }
  return extras;
}

async function resolveTextHighlightingCssVariables(extras: FormatExtras) {
  extras = ld.cloneDeep(extras);
  // Generate and inject the text highlighting css
  const kCssVariablesName = "quarto-css-variables";
  const theme = extras.pandoc?.[kHighlightStyle] || kDefaultHighlightStyle;
  if (theme) {
    const highlightCss = generateThemeCssVars(theme);
    if (highlightCss) {
      const highlightCssPath = await compileSass([{
        dependency: kCssVariablesName,
        key: kCssVariablesName,
        quarto: {
          defaults: "",
          functions: "",
          mixins: "",
          rules: highlightCss,
        },
      }], false);

      // Find the quarto-html dependency and inject this stylesheet
      const extraDeps = extras.html?.[kDependencies];
      if (extraDeps) {
        const existingDependency = extraDeps.find((extraDep) =>
          extraDep.name === kQuartoHtmlDependency
        );
        if (existingDependency) {
          existingDependency.stylesheets = existingDependency.stylesheets ||
            [];
          existingDependency.stylesheets.push({
            name: `${kCssVariablesName}.css`,
            path: highlightCssPath,
          });
        }
      }
    }
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
      info(stringify(printMetadata), { indent: 2 });
    }
  }
}

const kDefaultHighlightStyle = "arrow";
const kDarkSuffix = "dark";
const kLightSuffix = "light";

function textHighlightStyle(
  extras: FormatExtras,
  pandoc: FormatPandoc,
): string {
  // Get the user selected theme or choose a default
  const style = pandoc[kHighlightStyle] || kDefaultHighlightStyle;
  const dark = extras.html?.[kTextHighlightingMode];
  const theme = highlightFileForStyle(style, dark);

  // create the possible name matches based upon the dark vs. light
  // and find a matching theme file
  // Themes from
  // https://invent.kde.org/frameworks/syntax-highlighting/-/tree/master/data/themes
  return theme || style;
}

function highlightFileForStyle(
  style: string,
  darkOrLight: "dark" | "light" | undefined,
) {
  const names = [
    `${style}-${darkOrLight === "dark" ? kDarkSuffix : kLightSuffix}`,
    style,
  ];
  const theme = names.map((name) => {
    return resourcePath(join("pandoc", "highlight-styles", `${name}.theme`));
  }).find((path) => existsSync(path));
  return theme;
}

function hasDarkSentinel(cssFile: string) {
  // Look for a token indicating that that the theme is dark
  const css = Deno.readTextFileSync(cssFile);
  if (css.match(/\/\*! dark \*\//g)) {
    return true;
  } else {
    return false;
  }
}

function generateThemeCssVars(theme: string) {
  if (existsSync(theme)) {
    const themeRaw = Deno.readTextFileSync(theme);
    const themeJson = JSON.parse(themeRaw);
    const textStyles = themeJson["text-styles"];
    if (textStyles) {
      const lines: string[] = [];
      lines.push(":root {");
      Object.keys(textStyles).forEach((styleName) => {
        const abbr = kAbbrevs[styleName];
        if (abbr) {
          const textValues = textStyles[styleName];
          Object.keys(textValues).forEach((textAttr) => {
            switch (textAttr) {
              case "text-color":
                lines.push(
                  `  --quarto-hl-${abbr}-color: ${textValues[textAttr] ||
                    "inherit"};`,
                );
                break;
            }
          });
        }
      });
      lines.push("}");
      return lines.join("\n");
    }
  }
  return undefined;
}

// From  https://github.com/jgm/skylighting/blob/a1d02a0db6260c73aaf04aae2e6e18b569caacdc/skylighting-core/src/Skylighting/Format/HTML.hs#L117-L147
const kAbbrevs: Record<string, string> = {
  "Keyword": "kw",
  "DataType": "dt",
  "DecVal": "dv",
  "BaseN": "bn",
  "Float": "fl",
  "Char": "ch",
  "String": "st",
  "Comment": "co",
  "Other": "ot",
  "Alert": "al",
  "Function": "fu",
  "RegionMarker": "re",
  "Error": "er",
  "Constant": "cn",
  "SpecialChar": "sc",
  "VerbatimString": "vs",
  "SpecialString": "ss",
  "Import": "im",
  "Documentation": "do",
  "Annotation": "an",
  "CommentVar": "cv",
  "Variable": "va",
  "ControlFlow": "cf",
  "Operator": "op",
  "BuiltIn": "bu",
  "Extension": "ex",
  "Preprocessor": "pp",
  "Attribute": "at",
  "Information": "in",
  "Warning": "wa",
  "Normal": "",
};
