/*
* render-jats.test.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { join } from "../../../src/deno_ral/path.ts";
import { docs, outputForInput } from "../../utils.ts";
import {
 ensureXmlValidatesWithXsd,
} from "../../verify.ts";
import { testRender } from "../render/render.ts";

const xsdPath = docs(join("jats", "xsd", "JATS-Archiving-1-2-MathML2-DTD"));

// Test a basic JATS document that tests a variety of elements
const input = docs(join("jats", "basic.qmd"));
const output = outputForInput(input, "jats");
testRender(input, "jats", false, [ensureXmlValidatesWithXsd(output.outputPath, xsdPath)]);

// Test a nearly empty document
const emptyInput = docs(join("jats", "empty.qmd"));
const emptyOutput = outputForInput(emptyInput, "jats");
testRender(emptyInput, "jats", true, [ensureXmlValidatesWithXsd(emptyOutput.outputPath, xsdPath)]);
