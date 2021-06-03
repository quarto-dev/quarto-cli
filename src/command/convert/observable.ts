/*
* observable.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { info, warning } from "log/mod.ts";
import { basename, join } from "path/mod.ts";
import { writeAll } from "io/mod.ts";
import { ensureDirSync } from "fs/mod.ts";
import { pandocAutoIdentifier } from "../../core/pandoc/pandoc-id.ts";

const kObservableSiteUrl = "https://observablehq.com/";
const kObservableApiUrl = "https://api.observablehq.com/";
const kFormatHtml = "format: html";

export function isObservableUrl(url: string) {
  return url.startsWith(kObservableSiteUrl) ||
    url.startsWith(kObservableApiUrl);
}

export async function observableNotebookToMarkdown(
  url: string,
  output?: string,
) {
  // convert end-user url to api url if necessary
  if (url.startsWith(kObservableSiteUrl)) {
    const nbPath = url.slice(kObservableSiteUrl.length).replace(/^d\//, "");
    url = `${kObservableApiUrl}document/${nbPath}`;
  }

  // retreive and parse json
  const res = await fetch(url);
  const body = new Uint8Array(await res.arrayBuffer());
  const json = new TextDecoder().decode(body);
  const nb = JSON.parse(json);

  // see if we can determine a default file name
  let file = output || nb.id as string;
  const slug = nb.slug || nb.fork_of?.slug;
  if (typeof (slug) === "string") {
    file = slug;
  } else if (typeof (nb.title) === "string") {
    file = pandocAutoIdentifier(nb.title, false);
  }

  // determine/ensure output directory
  if (!output) {
    output = file;
  }
  ensureDirSync(output);
  info(`Writing converted notebook to: ${output}/`);

  // download attachments
  const attachments: string[] = [];
  for (const file of nb.files) {
    // download attachment
    info("  Downloading attachment: " + file.name);
    const res = await fetch(file.download_url);
    const contents = new Uint8Array(await res.arrayBuffer());
    const downloadTo = await Deno.create(join(output, file.name));
    await writeAll(downloadTo, contents);
    Deno.close(downloadTo.rid);
    // record attachment in list
    attachments.push(file.name);
  }

  // generate markdown
  const kModePrefixes = ["md", "html", "tex"];
  const lines: string[] = [];
  for (let i = 0; i < nb.nodes.length; i++) {
    // resolve mode and value
    const node = nb.nodes[i];
    let mode = node.mode as string;
    let value = node.value as string;
    const trimmedValue = value.trim();
    if (mode === "js") {
      const modePrefix = kModePrefixes.find((prefix) => {
        return trimmedValue.startsWith(prefix + "`") &&
          trimmedValue.endsWith("`");
      });
      if (modePrefix) {
        mode = modePrefix;
        value = trimmedValue.slice(mode.length + 1, trimmedValue.length - 1);
      }
    }

    // if this is the first node and it's a markdown H1 then use it as the title
    // also handle any metadata in the second node as well as attachements
    if (i === 0) {
      const match = mode === "md" ? value.match(/^\s*#\s+(.*)$/) : undefined;
      if (match || attachments.length > 0) {
        lines.push("---");
        if (match) {
          // extract title
          const title = match[1].trim();
          lines.push('title: "' + title + '"');
          // check for a metadata comment in the second node
          if (nb.nodes.length > 1 && nb.nodes[1].mode === "js") {
            const nodeValue = nb.nodes[1].value as string;
            const metaMatch = nodeValue.match(
              /^\s*\/\*-{3,}\s*([\S\s)]*)\n\-{3,}\*\/\s*$/,
            );
            if (metaMatch) {
              const yaml = metaMatch[1];
              if (!yaml.includes("format:")) {
                lines.push(kFormatHtml);
              }
              lines.push(yaml);
              i++; // skip this node since we already processed it
            } else {
              lines.push(kFormatHtml);
            }
          } else {
            lines.push(kFormatHtml);
          }
        }
        if (attachments.length > 0) {
          lines.push("attachments:");
          attachments.forEach((file) => {
            lines.push("  - " + file);
          });
        }
        lines.push("---");
        lines.push("");

        // if we matched the first cell then continue
        if (match) {
          continue;
        }
      }
    }

    // write lines
    switch (mode) {
      case "js":
        lines.push("```{ojs}");
        lines.push(value);
        lines.push("```");
        break;
      case "md":
        lines.push(value);
        break;
      case "html":
        lines.push("```{=html}");
        lines.push(value);
        lines.push("```");
        break;
      case "tex":
        lines.push("$$");
        lines.push(value);
        lines.push("$$");
        break;
      default:
        warning("Unknown mode: " + mode);
    }

    // space between blocks
    lines.push("");
  }
  // closing newline
  lines.push("");

  // write markdown
  const qmdFile = join(output, file + ".qmd");
  info("  Writing markdown: " + basename(qmdFile));
  Deno.writeTextFileSync(qmdFile, lines.join("\n"));
}
