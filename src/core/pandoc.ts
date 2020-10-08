export interface PandocIncludes {
  in_header?: string[];
  before_body?: string[];
  after_body?: string[];
}

export function pandocIncludesArgs(includes?: PandocIncludes): string[] {
  if (includes) {
    const args: string[] = [];
    const include = (name: string, value?: string[]) => {
      if (value) {
        args.push(name);
        const includeFile = Deno.makeTempFileSync(
          { prefix: name.replace(/^--/, "pandoc-"), suffix: ".html" },
        );
        Deno.writeTextFileSync(includeFile, value.join("\n"));
        args.push(includeFile);
      }
    };
    include("--include-in-header", includes.in_header);
    include("--include-before-body", includes.before_body);
    include("--include-after-body", includes.after_body);
    return args;
  } else {
    return [];
  }
}
