import type { FormatPandoc } from "../api/format.ts";

export interface PandocIncludes {
  in_header?: string;
  before_body?: string;
  after_body?: string;
}

// provide pandoc include-* arguments from strings
export function pandocIncludesOptions(
  includes?: PandocIncludes,
): FormatPandoc {
  const pandoc: FormatPandoc = {};
  if (includes) {
    const include = (name: string, value?: string) => {
      if (value) {
        const includeFile = Deno.makeTempFileSync();
        Deno.writeTextFileSync(includeFile, value);
        pandoc[name] = [includeFile];
      }
    };
    include("include-in-header", includes.in_header);
    include("include-before-body", includes.before_body);
    include("include-after-body", includes.after_body);
  }
  return pandoc;
}
