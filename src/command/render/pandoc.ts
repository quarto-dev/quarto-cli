/*
* pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

import { dirname, isAbsolute, join } from "path/mod.ts";

import { ensureDirSync, existsSync } from "fs/mod.ts";

import { stringify } from "encoding/yaml.ts";

import { execProcess } from "../../core/process.ts";
import { message } from "../../core/console.ts";
import { dirAndStem, pathWithForwardSlashes } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";
import { placeholderHtml } from "../../core/html.ts";

import {
  DependencyFile,
  Format,
  FormatExtras,
  FormatPandoc,
  kBodyEnvelope,
  kDependencies,
} from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { binaryPath, resourcePath } from "../../core/resources.ts";
import { pandocAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";

import { kResources, ProjectContext } from "../../project/project-context.ts";
import { projectType } from "../../project/types/project-types.ts";

import { RenderFlags } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { filterParamsJson, removeFilterParmas } from "./filters.ts";
import {
  kCss,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kPageTitle,
  kTitle,
  kTocTitle,
  kVariables,
} from "../../config/constants.ts";
import { sessionTempFile } from "../../core/temp.ts";

import { RenderResourceFiles } from "./render.ts";

// options required to run pandoc
export interface PandocOptions {
  // markdown input
  markdown: string;
  // input file being processed
  input: string;

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
): Promise<RenderResourceFiles | null> {
  // compute cwd for render
  const cwd = dirname(options.input);

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
  const printMetadata = {
    ...ld.cloneDeep(options.format.metadata),
    ...options.flags?.metadata,
  };

  // don't print params metadata (that's for the computation engine not pandoc)
  delete printMetadata.params;

  // don't print project metadata
  delete printMetadata.project;

  // see if the active project type wants to filter the metadata printed
  const projType = projectType(options.project?.metadata?.project?.type);
  if (projType.metadataFields) {
    for (const field of projType.metadataFields()) {
      delete printMetadata[field];
    }
  }

  // generate defaults and capture defaults to be printed
  let allDefaults = await generateDefaults(options) || {};
  const printAllDefaults = allDefaults ? ld.cloneDeep(allDefaults) : undefined;

  // provide arrow highlight style
  if (
    allDefaults[kHighlightStyle] === undefined ||
    allDefaults[kHighlightStyle] === "arrow"
  ) {
    allDefaults[kHighlightStyle] = Deno.realPathSync(
      resourcePath(join("pandoc", "arrow.theme")),
    );
  }

  // see if there are extras
  if (
    sysFilters.length > 0 || options.format.formatExtras ||
    options.project?.formatExtras
  ) {
    const projectExtras = options.project?.formatExtras
      ? (options.project.formatExtras(
        options.project,
        options.input,
        options.flags || {},
        options.format,
      ))
      : {};

    const formatExtras = options.format.formatExtras
      ? (options.format.formatExtras(options.flags || {}, options.format))
      : {};

    const extras = resolveExtras(
      projectExtras,
      formatExtras,
      cwd,
      options.libDir,
    );

    // provide default toc-title if necessary
    if (extras[kTocTitle]) {
      options.format.metadata[kTocTitle] = extras[kTocTitle];
    }

    // merge sysFilters if we have them
    if (sysFilters.length > 0) {
      extras.filters = extras.filters || {};
      extras.filters.post = extras.filters.post || [];
      extras.filters.post.unshift(...sysFilters);
    }

    // merge pandoc stuff
    if (extras.pandoc) {
      allDefaults = mergeConfigs(allDefaults, extras.pandoc);
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
  }

  // provide default page title if necessary
  if (
    !options.format.metadata[kTitle] &&
    !options.format.metadata[kPageTitle] &&
    !allDefaults?.[kVariables]?.[kTitle] &&
    !allDefaults?.[kVariables]?.[kPageTitle]
  ) {
    const [_dir, stem] = dirAndStem(options.input);
    args.push(
      "--metadata",
      `pagetitle:${pandocAutoIdentifier(stem, false)}`,
    );
  }

  // create a temp file for any filter results
  const filterResultsFile = sessionTempFile();

  // set parameters required for filters (possibily mutating all of it's arguments
  // to pull includes out into quarto parameters so they can be merged)
  const paramsJson = filterParamsJson(
    args,
    options,
    allDefaults,
    filterResultsFile,
  );

  // write the defaults file
  if (allDefaults) {
    const defaultsFile = await writeDefaultsFile(allDefaults);
    cmd.push("--defaults", defaultsFile);
  }

  // read the input file then append the metadata to the file (this is to that)
  // our fully resolved metadata, which incorporates project and format-specific
  // values, overrides the metadata contained within the file). we'll feed the
  // input to pandoc on stdin
  const input = options.markdown +
    "\n\n<!-- -->\n" +
    `\n---\n${stringify(options.format.metadata || {})}\n---\n`;

  // write input to temp file and pass it to pandoc
  const inputTemp = sessionTempFile({ prefix: "quarto-input", suffix: ".md" });
  Deno.writeTextFileSync(inputTemp, input);
  cmd.push(inputTemp);

  // add user command line args
  cmd.push(...args);

  // print full resolved input to pandoc
  if (!options.flags?.quiet && options.format.metadata) {
    runPandocMessage(
      printArgs,
      printAllDefaults,
      sysFilters,
      printMetadata,
    );
  }

  // apply workaround for .output suppression
  // https://github.com/jgm/pandoc/issues/6841#issuecomment-728281039
  // NOTE: only required for pandoc < v2.11.2 so we can probably remove this
  cmd.push("--ipynb-output=all");

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
  const globs: string[] = [];
  if (options.format.metadata[kResources]) {
    const files = options.format.metadata[kResources];
    if (Array.isArray(files)) {
      for (const file of files) {
        globs.push(String(file));
      }
    } else {
      globs.push(String(files));
    }
  }

  // resource files referenced from metadata (e.g. 'css')
  const files = formatResourceFiles(cwd, options.format);

  // resource files explicitly discovered by the filter
  // (e.g. referenced from links)
  if (existsSync(filterResultsFile)) {
    const filterResultsJSON = Deno.readTextFileSync(filterResultsFile);
    if (filterResultsJSON.trim().length > 0) {
      const filterResults = JSON.parse(filterResultsJSON);
      files.push(...(filterResults.resourceFiles || []));
    }
  }

  if (result.success) {
    return {
      globs,
      files,
    };
  } else {
    return null;
  }
}

export function pandocMetadataPath(path: string) {
  return pathWithForwardSlashes(path);
}

function resolveExtras(
  projectExtras: FormatExtras,
  formatExtras: FormatExtras,
  inputDir: string,
  libDir: string,
) {
  // start with the merge
  let extras = mergeConfigs(projectExtras, formatExtras);

  // project body envelope always wins
  if (projectExtras[kBodyEnvelope]) {
    extras[kBodyEnvelope] = projectExtras[kBodyEnvelope];
  }

  // project default toc title always wins
  if (projectExtras[kTocTitle]) {
    extras[kTocTitle] = projectExtras[kTocTitle];
  }

  // resolve dependencies
  extras = resolveDependencies(extras, inputDir, libDir);

  // resolve body envelope
  extras = resolveBodyEnvelope(extras);

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
  const lines: string[] = [];
  if (extras[kDependencies]) {
    for (const dependency of extras[kDependencies]!) {
      const dir = `${dependency.name}-${dependency.version}`;
      const targetDir = join(inputDir, libDir, dir);
      // deno-lint-ignore no-explicit-any
      const copyDep = (file: DependencyFile, template?: any) => {
        const targetPath = join(targetDir, file.name);
        ensureDirSync(dirname(targetPath));
        Deno.copyFileSync(file.path, targetPath);
        if (template) {
          const href = join(libDir, dir, file.name);
          lines.push(template({ href }));
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
      if (dependency.resources) {
        dependency.resources.forEach(copyDep);
      }
    }
    delete extras[kDependencies];

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

  const envelope = extras[kBodyEnvelope];
  if (envelope) {
    const writeBodyFile = (
      type: "include-in-header" | "include-before-body" | "include-after-body",
      contents?: string,
    ) => {
      if (contents) {
        contents = placeholderHtml(`envelope-${type}`, contents);
        const file = sessionTempFile({ suffix: ".html" });
        Deno.writeTextFileSync(file, contents);
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

    delete extras[kBodyEnvelope];
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
  message(`pandoc ${args.join(" ")}`, { bold: true });
  if (pandoc) {
    message(pandocDefaultsMessage(pandoc, sysFilters, debug), { indent: 2 });
  }

  const keys = Object.keys(metadata);
  if (keys.length > 0) {
    const printMetadata = ld.cloneDeep(metadata) as Metadata;
    delete printMetadata.format;

    // remove filter params
    removeFilterParmas(printMetadata);

    // print message
    if (Object.keys(printMetadata).length > 0) {
      message("metadata", { bold: true });
      message(stringify(printMetadata), { indent: 2 });
    }
  }
}

function formatResourceFiles(dir: string, format: Format) {
  const cssValue = format.pandoc[kCss];
  const css = typeof (cssValue) === "string"
    ? [cssValue]
    : Array.isArray(cssValue)
    ? cssValue.map((val) => String(val))
    : [];

  const files = css
    .filter((file) => !isAbsolute(file))
    .filter((file) => {
      const path = join(dir, file);
      return existsSync(path) && Deno.statSync(path).isFile;
    });

  return files;
}

/* more aggressive exclude-list version
function formatResourceFiles(dir: string, format: Format) {

  const resourceFiles: string[] = [];
  const findResources = (
    collection: Array<unknown> | Record<string, unknown>,
  ) => {

    ld.forEach(
      collection,
      (value: unknown, index: unknown) => {
        // there are certain keys that we expressly don't want to capture
        // resource files from (e.g. includes, output-file, etc.)
        if (typeof (index) === "string") {
          if (
            [
              kResources,
              kOutputFile,
              kInputFiles,
              kIncludeInHeader,
              kIncludeBeforeBody,
              kIncludeAfterBody,
              kBibliography,
              kCsl,
              kTemplate,
              kFilters,
              kMetadataFile,
              kMetadataFiles,
              kLogFile,
              kHighlightStyle,
              kSyntaxDefinition,
              kSyntaxDefinitions,
              kReferenceDoc,
            ].includes(index)
          ) {
            return;
          }
        }

        if (Array.isArray(value)) {
          findResources(value);
        } else if (typeof (value) === "object") {
          findResources(value as Record<string, unknown>);
        } else if (typeof (value) === "string") {
          if (!isAbsolute(value)) {
            const resourceFile = join(dir, value);
            try {
              if (
                existsSync(resourceFile) && Deno.statSync(resourceFile).isFile
              ) {
                resourceFiles.push(value);
              }
            } catch (e) {
              // existsSync / statSync could throw for things like path too long
              // or invalid characters. Since we're using this to identify paths
              // we can safely ignore these errors.
            }
          }
        }
      },
    );
  };
  findResources(format as unknown as Record<string, unknown>);
  return ld.uniq(resourceFiles);
}
*/
