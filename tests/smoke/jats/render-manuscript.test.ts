/*
* render-manuscript.test.ts
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
const projectOutDir = "_manuscript";

const testContext = undefined;
const args = undefined;

// Test a basic manuscript render (this will include a sub-notebook which should
// nonetheless validate)
const input = docs(join("jats", "manuscript", "index.ipynb"));
const output = outputForInput(input, "jats", projectOutDir);

// Test the article and ensure that it validates
testRender(input, "jats", false, [ensureXmlValidatesWithXsd(output.outputPath, xsdPath)], testContext, args, projectOutDir);

