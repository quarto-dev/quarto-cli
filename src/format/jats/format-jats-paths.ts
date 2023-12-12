/*
 * format-jats-paths.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { join } from "path/mod.ts";

import { formatResourcePath } from "../../core/resources.ts";

export const subarticleTemplatePath = formatResourcePath(
  "jats",
  join("pandoc", "subarticle", "template.xml"),
);
