/*
* types.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

export interface YamlIntelligenceContext {
  code: MappedString;
  position: {
    row: number;
    column: number
  };
  schema?: Schema;
  line?: String;
  commentPrefix?: String;
};
