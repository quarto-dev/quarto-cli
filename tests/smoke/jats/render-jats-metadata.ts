/*
* render-jats.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { extname, join } from "path/mod.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
 ensureXmlValidatesWithXsd,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";

const xsdPath = docs(join("jats", "xsd", "JATS-Archiving-1-2-MathML2-DTD"));

// Test all the documents in this folder
const testDir = docs(join("author-normalization", "funding"));

for (const entry of Deno.readDirSync(testDir)) {
  if (entry.isFile && extname(entry.name) === ".qmd")  {
    const input = join(testDir, entry.name);
    const output = outputForInput(input, "jats");
    testRender(input, "jats", true, [ensureXmlValidatesWithXsd(output.outputPath, xsdPath)]);
  }
}

