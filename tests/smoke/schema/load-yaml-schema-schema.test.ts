/*
* load-yaml-schema-schema.test.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { getSchema } from "../../../src/core/schema/yaml-schema-schema.ts";
import { test } from "../../test.ts";

test({
  verify: [],
  "type": "smoke",
  name: "yaml schema schema loads",
  context: {},
  execute: async () => {
    getSchema();
  }
});
