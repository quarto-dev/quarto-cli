/*
 * ejs.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { dirname, join } from "../deno_ral/path.ts";

import * as ld from "./lodash.ts";
import { lines } from "./text.ts";
import { InternalError } from "./lib/error.ts";

export type EjsData = {
  [key: string]: unknown;
};

interface CachedTemplate {
  mtime: number;
  compileTemplate: CompileTemplate;
}

type CompileTemplate = (data: unknown) => string;

export function renderEjs(
  file: string,
  data: unknown,
  removeEmptyLines = true,
  cache = true,
): string {
  // compile template
  const template = compileTemplate(file, removeEmptyLines, cache);
  if (!template) {
    throw new InternalError(
      `Rendering the template ${file} failed unexpectedly.`,
    );
  }

  // render it, passing an include function for partials
  return lines(template(data).trimLeft())
    .filter((line) => !removeEmptyLines || (line.trim().length > 0))
    .join("\n") + "\n";
}

// A cache that holds compiled template functions.
const compiledTemplates = new Map<string, CachedTemplate>();

// Compiles the template using a cache, if needed
function compileTemplate(
  file: string,
  removeEmptyLines: boolean,
  cache = true,
) {
  // Check the current file modified time
  const mtime = Deno.statSync(file).mtime?.getTime() || Number.MAX_VALUE;

  const compile = () => {
    const template =
      `<% const partial = (file, data) => print(include(file, data)); %>
    ${Deno.readTextFileSync(file)}`;

    return ld.template(template, {
      imports: {
        include: (includeFile: string, includeData: unknown) => {
          return renderEjs(
            join(dirname(file), includeFile),
            includeData,
            removeEmptyLines,
          );
        },
      },
    });
  };
  if (!cache) {
    return compile();
  } else {
    const cachedTemplate = compiledTemplates.get(file);
    if (!cachedTemplate || cachedTemplate.mtime < mtime) {
      compiledTemplates.set(
        file,
        {
          mtime,
          compileTemplate: compile(),
        },
      );
    }
  }
  return compiledTemplates.get(file)?.compileTemplate;
}
