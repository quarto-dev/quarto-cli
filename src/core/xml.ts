/*
 * xml.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { which } from "./path.ts";
import { execProcess } from "./process.ts";

import { warning } from "../deno_ral/log.ts";

const kXmlLint = "xmllint";

// Reformats the XML in place if possible
export async function reformat(xmlFile: string) {
  if (Deno.build.os !== "windows") {
    const xmlLint = await which(kXmlLint);
    if (xmlLint) {
      const result = await execProcess(kXmlLint, {
        args: [
          xmlFile,
          "--format",
          "-o",
          xmlFile,
        ],
      });
      if (!result.success) {
        warning("Unable to reformat the XML file " + xmlFile);
      }
    }
  }
}
