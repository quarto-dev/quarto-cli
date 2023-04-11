/*
* render-jats.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { join } from "path/mod.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
 ensureXmlValidatesWithXsd,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";

const xsdPath = docs(join("jats", "xsd", "JATS-Archiving-1-2-MathML2-DTD"));
const input = docs(join("jats", "basic.qmd"));
const output = outputForInput(input, "jats");

testRender(input, "jats", false, [ensureXmlValidatesWithXsd(output.outputPath, xsdPath)]);
