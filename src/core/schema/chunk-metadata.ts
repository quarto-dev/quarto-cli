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
  mappedIndexToRowCol
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
  anyOfSchema as anyOfS,
  arraySchema as arrayS,
  enumSchema as enumS,
  numericSchema as numericS,
  objectSchema as objectS,
  
  BooleanSchema as BooleanS,
  StringSchema as StringS,
  NullSchema as NullS,
} from "./common.ts";

import {
  kCellAutoscroll,
  kCellClasses,
  kCellColab,
  kCellColabType,
  kCellColbOutputId,
  kCellCollapsed,
  kCellDeletable,
  kCellFigAlign,
  kCellFigAlt,
  kCellFigCap,
  kCellFigEnv,
  kCellFigLink,
  kCellFigPos,
  kCellFigScap,
  kCellFigSubCap,
  kCellFormat,
  kCellId,
  kCellLabel,
  kCellLinesToNext,
  kCellLstCap,
  kCellLstLabel,
  kCellMdIndent,
  kCellName,
  kCellOutHeight,
  kCellOutWidth,
  kCellPanel,
  kCellTags,
  kCodeFold,
  kCodeOverflow,
  kCodeSummary,
  kEcho,
  kError,
  kEval,
  kInclude,
  kLayout,
  kLayoutAlign,
  kLayoutNcol,
  kLayoutNrow,
  kLayoutVAlign,
  kOutput,
  kRawMimeType,
  kWarning,
} from "../../config/constants.ts";

const commonCellOptionsSchema = objectS({
  properties: {
    [kCellLabel]: StringS,
    [kCellFigCap]: anyOfS(StringS, arrayS(StringS)),
    [kCellFigSubCap]: arrayS(StringS),
    [kCellLstLabel]: StringS,
    [kCellLstCap]: StringS,
    [kCellClasses]: StringS,
    [kCellPanel]: StringS,
    [kCodeFold]: StringS,
    [kCodeSummary]: StringS,
    [kCodeOverflow]: StringS, // FIXME should this be enumS("wrap", "scroll")?
    
    [kCellFigScap]: StringS,
    [kCellFigLink]: StringS,
    [kCellFigAlign]: StringS,
    [kCellFigEnv]: StringS,
    [kCellFigPos]: StringS,
    [kCellFigAlt]: StringS,
    
    [kEval]: anyOfS(BooleanS, NullS),
    [kError]: BooleanS,
    [kEcho]: anyOfS(BooleanS, enumS("fenced")),
    [kOutput]: anyOfS(BooleanS, enumS("all", "asis")),
    [kInclude]: BooleanS,
    
    [kLayoutNcol]: numericS({
      "type": "integer",
      "minimum": 1,
    }),
    [kLayoutNrow]: numericS({
      "type": "integer",
      "minimum": 1,
    }),
  },
  
});

export const ojsCellOptionsSchema = objectS({
  baseSchema: commonCellOptionsSchema,
  properties: {
    classes: arrayS(StringS)
  },
  description: "be an OJS cell options object"
});

export const jupyterCellOptionsSchema = objectS({
  baseSchema: commonCellOptionsSchema,
  properties: {
    [kCellMdIndent]: StringS,
    [kWarning]: BooleanS,
    },
  description: "be a Jupyter cell options object"
});

export const ojsCellOptions = new YAMLSchema(ojsCellOptionsSchema);
export const jupyterCellOptions = new YAMLSchema(jupyterCellOptionsSchema);
export const rCellOptions = new YAMLSchema(commonCellOptionsSchema);

export const languageOptionsValidators: Record<string, YAMLSchema> = {
  "ojs": ojsCellOptions,
  "python": jupyterCellOptions,
  "r": rCellOptions
};

