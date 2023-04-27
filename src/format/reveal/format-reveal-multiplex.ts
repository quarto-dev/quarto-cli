/*
 * format-reveal-multiplex.ts
 *
 * Copyright (C) 2021-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";
import { isSelfContainedOutput } from "../../command/render/render-info.ts";
import { kResourcePath } from "../../config/constants.ts";

import { Format, FormatExtras, PandocFlags } from "../../config/types.ts";
import { pandocIngestSelfContainedContent } from "../../core/pandoc/self-contained.ts";
import { dirAndStem, pathWithForwardSlashes } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";
import { lines } from "../../core/text.ts";

export const kRevealJsMultiplex = "multiplex";

export function revealMultiplexPlugin(format: Format): string | undefined {
  if (format.metadata[kRevealJsMultiplex]) {
    return formatResourcePath("revealjs", join("plugins", "multiplex"));
  } else {
    return undefined;
  }
}

export function revealMuliplexPreviewFile(file: string) {
  const speakerFile = revealSpeakerOutput(file);
  if (existsSync(speakerFile) && existsSync(file)) {
    // return speaker file if it's >= mod time of file
    const modTime = Deno.statSync(file).mtime;
    const speakerModTime = Deno.statSync(speakerFile).mtime;
    if (modTime && speakerModTime && (speakerModTime > modTime)) {
      return speakerFile;
    }
  }
  return file;
}

export function revealMultiplexExtras(
  format: Format,
  flags: PandocFlags,
): FormatExtras | undefined {
  if (format.metadata[kRevealJsMultiplex]) {
    // create speaker version w/ master
    return {
      postprocessors: [async (output: string) => {
        // determine the multiplex secret and id (could be provided by the
        // user, contained within existing speaker output, or created from
        // scratch via a call to the multiplex url)
        const token = await revealMultiplexToken(format, output);

        // read file
        const content = await Deno.readTextFile(output);

        // generate speaker content
        const speakerContent = withMultiplexToken(content, token);

        // generate client content (remove the secret and the speaker notes)
        token.secret = null;
        const clientContent = withMultiplexToken(content, token)
          .replace(
            /(\/\/ reveal\.js plugins\n\s*plugins: \[[^\[]+?)(RevealNotes,)([^\[]+?\])/,
            "$1$3",
          );

        // write client version
        await Deno.writeTextFile(output, clientContent);

        // write speaker version
        const speakerOutput = revealSpeakerOutput(output);
        await Deno.writeTextFile(speakerOutput, speakerContent);

        // determine whether this is self-contained output
        const selfContained = isSelfContainedOutput(
          flags,
          format,
          speakerOutput,
        );

        // If this is self contained, we should ingest dependencies
        if (selfContained) {
          await pandocIngestSelfContainedContent(
            speakerOutput,
            format.pandoc[kResourcePath],
          );
        }
      }],
    };
  } else {
    return undefined;
  }
}

function revealSpeakerOutput(output: string) {
  const [dir, stem] = dirAndStem(output);
  return join(dir, `${stem}-speaker.html`);
}

interface RevealMultiplexToken {
  secret: string | null;
  id: string;
  url: string;
}

const kDefaultMultiplexUrl = "https://reveal-multiplex.glitch.me/";

async function revealMultiplexToken(
  format: Format,
  output: string,
): Promise<RevealMultiplexToken> {
  // is it provided in config?
  const multiplex = format.metadata[kRevealJsMultiplex] as RevealMultiplexToken;
  if (
    typeof (multiplex) === "object" && typeof (multiplex.secret) === "string" &&
    typeof (multiplex.id) === "string"
  ) {
    multiplex.url = multiplex.url || kDefaultMultiplexUrl;
    return multiplex;
  }

  // is it located inside the -speaker file?
  const speakerOutput = revealSpeakerOutput(output);
  if (existsSync(speakerOutput)) {
    const speakerContent = await Deno.readTextFile(speakerOutput);
    const initPos = speakerContent.lastIndexOf("Reveal.initialize({");
    if (initPos !== -1) {
      const initLines = lines(speakerContent.substring(initPos));
      const kMultiplexStart = "'multiplex': {";
      const kMultiplexEnd = "},";
      for (const line of initLines) {
        if (line.startsWith(kMultiplexStart) && line.endsWith(kMultiplexEnd)) {
          const multiplexJson = "{ " +
            line.substring(
              kMultiplexStart.length,
              line.length - kMultiplexEnd.length,
            ) + " }";
          const multiplex = JSON.parse(multiplexJson) as RevealMultiplexToken;
          if (!!multiplex.id && !!multiplex.secret) {
            return multiplex;
          }
        }
      }
    }
  }

  // provision a new token
  const url = typeof (multiplex) === "object"
    ? (multiplex.url || kDefaultMultiplexUrl)
    : kDefaultMultiplexUrl;
  try {
    const response = await fetch(pathWithForwardSlashes(join(url, "token")));
    const jsonData = await response.json();
    const multiplex = {
      secret: jsonData.secret,
      id: jsonData.socketId,
      url,
    };
    return multiplex;
  } catch (e) {
    throw Error(
      "Error attempting to provision multiplex token from '" + url + "': " +
        e.message,
    );
  }
}

function withMultiplexToken(content: string, token: RevealMultiplexToken) {
  return content.replace(
    /(Reveal.initialize\({[\s\S]*?'multiplex': )({.*?},)/g,
    `$1${JSON.stringify(token)},`,
  );
}
