/*
* ejs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import * as ld from "./lodash.ts";
import { lines } from "./text.ts";

export type EjsData = {
  [key: string]: unknown;
};

export function renderEjs(
  file: string,
  data: unknown,
  removeEmptyLines = true,
): string {
  // compile template
  const template = compileTemplate(file, removeEmptyLines);

  // render it, passing an include function for partials
  return lines(template(data).trimLeft())
    .filter((line) => !removeEmptyLines || (line.trim().length > 0))
    .join("\n") + "\n";
}

const compiledTemplates = new Map<string, unknown>();
function compileTemplate(file: string, removeEmptyLines: boolean) {
  if (!compiledTemplates.has(file)) {
    const template =
      `<% const partial = (file, data) => print(include(file, data)); %>
      ${Deno.readTextFileSync(file)}`;

    compiledTemplates.set(
      file,
      ld.template(template, {
        imports: {
          include: (includeFile: string, includeData: unknown) => {
            return renderEjs(
              join(dirname(file), includeFile),
              includeData,
              removeEmptyLines,
            );
          },
        },
      }),
    );
  }
  return compiledTemplates.get(file) as (
    data: unknown,
  ) => string;
}
