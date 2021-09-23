/*
* chunk-metadata.ts
*
* JSON Schema for Quarto's YAML chunk metadata
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import {
  mappedString,
  asMappedString,
  mappedLineNumbers
} from "../mapped-text.ts";

import {
  rangedLines
} from "../ranged-text.ts";

import {
  YAMLSchema
} from "./yaml-schema.ts";

import {
  error
} from "log/mod.ts";

import {
  anySchema as anyS,
  objectSchema as objectS,
  enumSchema as enumS,
  anyOfSchema as anyOfS,
  BooleanSchema as BooleanS,
} from "./common.ts";

export const ojsChunkMetadataSchema = objectS({
  properties: {
    echo: anyOfS(BooleanS, enumS("fenced"))
  },
  description: "be an OJS chunk metadata object"
});

export const ojsChunkMetadata = new YAMLSchema(ojsChunkMetadataSchema);

export const languageChunkValidators: Record<string, YAMLSchema> = {
  "ojs": ojsChunkMetadata
};
