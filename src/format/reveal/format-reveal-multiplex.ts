/*
* format-reveal-multiplex.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { existsSync } from "fs/mod.ts";
import { join } from "path/mod.ts";

import { Format, FormatExtras } from "../../config/types.ts";
import { dirAndStem } from "../../core/path.ts";
import { formatResourcePath } from "../../core/resources.ts";

export const kRevealJsMultiplex = "multiplex";

export function revealMultiplexPlugin(format: Format): string | undefined {
  if (format.metadata[kRevealJsMultiplex]) {
    return formatResourcePath("revealjs", join("plugins", "multiplex"));
  } else {
    return undefined;
  }
}

export function revealMuliplexPreviewFile(file: string, format: Format) {
  if (format.metadata[kRevealJsMultiplex]) {
    const speakerFile = revealSpeakerOutput(file);
    if (existsSync(speakerFile)) {
      return speakerFile;
    }
  }
  return file;
}

export function revealMultiplexExtras(
  format: Format,
): FormatExtras | undefined {
  if (format.metadata[kRevealJsMultiplex]) {
    // create speaker version w/ master
    return {
      postprocessors: [async (output: string) => {
        // read file
        const content = await Deno.readTextFile(output);

        // substitute master.js for client.js
        const speakerContent = content.replace(
          'revealjs/plugin/multiplex/client.js" async',
          'revealjs/plugin/multiplex/master.js" async',
        );

        // write speakder version
        const speakerOutput = revealSpeakerOutput(output);
        await Deno.writeTextFile(speakerOutput, speakerContent);

        // remove the secret and the speaker notes from the client version
        let clientContent = content.replace(
          /(\nmultiplex:\s*{.*?"secret":)("\w+")/,
          "$1 null",
        );
        clientContent = clientContent.replace(
          /(\/\/ reveal\.js plugins\n\s*plugins: \[[^\[]+?)(RevealNotes,)([^\[]+?\])/,
          "$1$3",
        );

        await Deno.writeTextFile(output, clientContent);
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
