import type {
  FormatPandocOptions,
} from "../api/format.ts";

export interface PandocIncludes {
  in_header?: string;
  before_body?: string;
  after_body?: string;
}

export function pandocIncludesOptions(
  includes?: PandocIncludes,
): FormatPandocOptions {
  const pandoc: FormatPandocOptions = {};
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
