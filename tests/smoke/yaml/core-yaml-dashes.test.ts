/*
* core-yaml-dashes.test.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import * as utils from "../../utils.ts";
import * as render from "../render/render.ts";

const input = utils.docs("yaml/yaml-parse-dashes.qmd");

render.testRender(input, "revealjs", false);
