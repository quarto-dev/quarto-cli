/*
* register.ts
*
* registers available project types for use in quarto.
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { bookProjectType } from "./book/book.ts";
import { defaultProjectType } from "./project-default.ts";
import { websiteProjectType } from "./website/website.ts";
import { registerProjectType } from "./project-types.ts";
import { manuscriptProjectType } from "./manuscript/manuscript.ts";

registerProjectType(bookProjectType);
registerProjectType(defaultProjectType);
registerProjectType(websiteProjectType);
registerProjectType(manuscriptProjectType);
