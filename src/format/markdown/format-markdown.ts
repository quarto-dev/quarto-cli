/*
* format-markdown.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function requiresShortcodeUnescapePostprocessor(markdown: string) {
  return markdown.includes("{{{<");
}

export function shortcodeUnescapePostprocessor(output: string): Promise<void> {
  // unescape shortcodes
  Deno.writeTextFileSync(
    output,
    Deno.readTextFileSync(output)
      .replaceAll("{{\\<", "{{<")
      .replaceAll("\\>}}", ">}}"),
  );
  return Promise.resolve();
}
