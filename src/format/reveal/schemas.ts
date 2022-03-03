/*
* schemas.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import {
  anyOfSchema as anyOfS,
  arraySchema as arrayS,
  booleanSchema as booleanS,
  idSchema as withId,
  objectSchema as objectS,
  stringSchema as stringS,
} from "../../core/lib/yaml-schema/common.ts";

import { kSelfContained } from "../../config/constants.ts";

const scriptSchema = anyOfS(
  stringS,
  objectS({
    properties: {
      path: stringS,
      "async": booleanS,
    },
    required: ["path"],
    // FIXME is this an exhaustive schema?
  }),
);
export const revealPluginSchema = withId(
  objectS({
    properties: {
      path: stringS,
      name: stringS,
      register: booleanS,
      script: anyOfS(scriptSchema, arrayS(scriptSchema)),
      stylesheet: anyOfS(stringS, arrayS(stringS)),
      // FIXME what's the schema for metadata?
      [kSelfContained]: booleanS,
    },
    required: ["name"],
    // FIXME is this an exhaustive schema?
  }),
  "plugin-reveal",
);
