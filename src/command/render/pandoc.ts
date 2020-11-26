/*
* pandoc.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/

import { ld } from "lodash/mod.ts";

import { dirname } from "path/mod.ts";
import { stringify } from "encoding/yaml.ts";

import { execProcess, ProcessResult } from "../../core/process.ts";
import { message } from "../../core/console.ts";

import { Format, FormatPandoc } from "../../config/format.ts";
import { Metadata } from "../../config/metadata.ts";
import { kListings } from "../../config/constants.ts";

import { RenderFlags } from "./flags.ts";
import {
  generateDefaults,
  pandocDefaultsMessage,
  writeDefaultsFile,
} from "./defaults.ts";

// options required to run pandoc
export interface PandocOptions {
  // input file
  input: string;
  // target format
  format: Format;
  // command line args for pandoc
  args: string[];
  // command line flags (e.g. could be used
  // to specify e.g. quiet or pdf engine)
  flags?: RenderFlags;
}

export async function runPandoc(
  options: PandocOptions,
): Promise<ProcessResult> {
  // build the pandoc command (we'll feed it the input on stdin)
  const cmd = ["pandoc"];

  // generate defaults and write a defaults file if need be
  const allDefaults = await generateDefaults(options);
  if (allDefaults) {
    const defaultsFile = await writeDefaultsFile(allDefaults);
    cmd.push("--defaults", defaultsFile);
  }

  // forward --listings to crossref if necessary
  if (crossrefFilterActive(options.format)) {
    if (options.flags?.listings || options.format.pandoc[kListings]) {
      setCrossrefMetadata(options.format, "listings", true);
    }
  }

  // read the input file then append the metadata to the file (this is to that)
  // our fully resolved metadata, which incorporates project and format-specific
  // values, overrides the metadata contained within the file). we'll feed the
  // input to pandoc on stdin
  const input = Deno.readTextFileSync(options.input) +
    `\n---\n${stringify(options.format.metadata || {})}\n---\n`;

  // build command line args
  const args = [...options.args];

  // provide default title based on filename if necessary
  if (!options.format.metadata["title"]) {
    args.push(
      "--metadata",
      "title:" + options.input.slice(0, options.input.indexOf(".")),
    );
  }

  // propagate quiet
  if (options.flags?.quiet) {
    args.push("--quiet");
  }

  // add user command line args
  cmd.push(...args);

  // print full resolved input to pandoc
  if (!options.flags?.quiet && options.format.metadata) {
    runPandocMessage(
      args,
      allDefaults,
      options.format.metadata,
    );
  }

  // apply workaround for .output suppression
  // https://github.com/jgm/pandoc/issues/6841#issuecomment-728281039
  cmd.push("--ipynb-output=all");

  // run pandoc
  return await execProcess(
    {
      cmd,
      cwd: dirname(options.input),
    },
    input,
  );
}

export function crossrefFilterActive(format: Format) {
  return format.metadata.crossref !== false;
}

function setCrossrefMetadata(
  format: Format,
  key: string,
  value: unknown,
) {
  if (typeof format.metadata.crossref !== "object") {
    format.metadata.crossref = {} as Record<string, unknown>;
  }
  // deno-lint-ignore no-explicit-any
  (format.metadata.crossref as any)[key] = value;
}

function runPandocMessage(
  args: string[],
  pandoc: FormatPandoc | undefined,
  metadata: Metadata,
  debug?: boolean,
) {
  message(`pandoc ${args.join(" ")}`, { bold: true });
  if (pandoc) {
    message(pandocDefaultsMessage(pandoc, debug), { indent: 2 });
  }

  if (Object.keys(metadata).length > 0) {
    message("metadata", { bold: true });
    const printMetadata = ld.cloneDeep(metadata);
    delete printMetadata.format;

    // cleanup synthesized crossref metadata
    if (printMetadata.crossref) {
      const crossref = printMetadata.crossref as Record<string, unknown>;
      if (crossref.listings !== undefined) {
        delete crossref.listings;
      }
      if (Object.keys(crossref).length === 0) {
        delete printMetadata.crossref;
      }
    }

    message(stringify(printMetadata), { indent: 2 });
  }
}
