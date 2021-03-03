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
import { pathWithForwardSlashes } from "../../core/path.ts";
import { mergeConfigs } from "../../core/config.ts";

import {
  DependencyFile,
  Format,
  FormatDependency,
  FormatExtras,
  FormatPandoc,
  kDependencies,
} from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { binaryPath } from "../../core/resources.ts";

import { RenderFlags } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";
import { removeFilterParmas, setFilterParams } from "./filters.ts";
import {
  kBibliography,
  kCsl,
  kFilters,
  kHighlightStyle,
  kIncludeAfterBody,
  kIncludeBeforeBody,
  kIncludeInHeader,
  kInputFiles,
  kLogFile,
  kMetadataFile,
  kMetadataFiles,
  kOutputFile,
  kReferenceDoc,
  kSyntaxDefinition,
  kSyntaxDefinitions,
  kTemplate,
  kVariables,
} from "../../config/constants.ts";
import { sessionTempFile } from "../../core/temp.ts";
import { kResources, ProjectContext } from "../../project/project-context.ts";
import { RenderResourceFiles } from "./render.ts";

// options required to run pandoc
export interface PandocOptions {
  // markdown input
  markdown: string;
  // working dir for conversion
  cwd: string;

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
  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = [binaryPath("pandoc")];

  // build command line args
  const args = [...options.args];

  // provide default title if necessary
  if (!options.format.metadata["title"]) {
    args.push(
      "--metadata",
      "title:untitled",
    );
  }

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

  // don't print navigation metadata
  delete printMetadata.navbar;

  // generate defaults and capture defaults to be printed
  let allDefaults = await generateDefaults(options) || {};
  const printAllDefaults = allDefaults ? ld.cloneDeep(allDefaults) : undefined;

  // see if there are extras
  if (
    sysFilters.length > 0 || options.format.formatExtras ||
    options.project?.formatExtras
  ) {
    const projectExtras = options.project?.formatExtras
      ? (options.project.formatExtras(options.format))
      : {};

    const formatExtras = options.format.formatExtras
      ? (options.format.formatExtras(options.format))
      : {};

    const extras = resolveExtras(
      projectExtras,
      formatExtras,
      options.cwd,
      options.libDir,
    );

    // merge sysFilters if we have them
    if (sysFilters.length > 0) {
      extras.filters = extras.filters || {};
      extras.filters.post = extras.filters.post || [];
      extras.filters.post.unshift(...sysFilters);
    }

    // merge the extras into the defaults
    if (extras[kVariables]) {
      allDefaults = {
        ...allDefaults,
        [kVariables]: mergeConfigs(
          extras[kVariables] || {},
          allDefaults[kVariables],
        ),
      };
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

  // create a temp file for any filter results
  const filterResultsFile = sessionTempFile();

  // set parameters required for filters (possibily mutating all of it's arguments
  // to pull includes out into quarto parameters so they can be merged)
  setFilterParams(args, options, allDefaults, filterResultsFile);

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
      cwd: options.cwd,
    },
    input,
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
  const files = formatResourceFiles(options.cwd, options.format);

  // resource files explicitly discovered by the filter
  // (e.g. referenced from links)
  if (existsSync(filterResultsFile)) {
    const filterResultsJSON = Deno.readTextFileSync(filterResultsFile);
    const filterResults = JSON.parse(filterResultsJSON);
    files.push(...(filterResults.resourceFiles || []));
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
  const extras = mergeConfigs(projectExtras, formatExtras);

  // resolve dependencies
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
      const copyDep = (file: DependencyFile, template: any) => {
        const targetPath = join(targetDir, file.name);
        ensureDirSync(dirname(targetPath));
        Deno.copyFileSync(file.path, targetPath);
        const href = join(libDir, dir, file.name);
        lines.push(template({ href }));
      };
      if (dependency.scripts) {
        dependency.scripts.forEach((script) => copyDep(script, scriptTemplate));
      }
      if (dependency.stylesheets) {
        dependency.stylesheets.forEach((stylesheet) =>
          copyDep(stylesheet, stylesheetTempate)
        );
      }
    }
    delete extras[kDependencies];
  }

  // write to external file
  const dependenciesHead = sessionTempFile({
    prefix: "dependencies",
    suffix: ".html",
  });
  Deno.writeTextFileSync(dependenciesHead, lines.join("\n"));
  extras[kIncludeInHeader] = [dependenciesHead].concat(
    extras[kIncludeInHeader] || [],
  );

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
