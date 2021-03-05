/*
* ejs.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { dirname, join } from "path/mod.ts";

import { ld } from "lodash/mod.ts";

export type EjsData = {
  [key: string]: unknown;
};

export function renderEjs(file: string, data: unknown): string {
  // compile template
  const template = compileTemplate(file);

  // render it, passing an include function for partials
  return template(data);
}

const compiledTemplates = new Map<string, unknown>();
function compileTemplate(file: string) {
  if (!compiledTemplates.has(file)) {
    const template =
      `<% const partial = (file, data) => print(include(file, data)); %>
      ${Deno.readTextFileSync(file)}`;

    compiledTemplates.set(
      file,
      ld.template(template, {
        imports: {
          include: (includeFile: string, includeData: unknown) => {
            return renderEjs(join(dirname(file), includeFile), includeData);
          },
        },
      }),
    );
  }
  return compiledTemplates.get(file) as (
    data: unknown,
  ) => string;
}
