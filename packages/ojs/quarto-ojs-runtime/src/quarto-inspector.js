/*
* quarto-inspector.js
*
* Copyright (C) 2022 RStudio, PBC
*
*/

import { Inspector } from "external-observablehq-runtime";

export class QuartoInspector extends Inspector {
  constructor(node, cellAst) {
    super(node);
    this._cellAst = cellAst;
  }
  rejected(error) {
    console.error(`Error evaluating OJS cell\n${this._cellAst.input}\n${String(error)}`);
    return super.rejected(error);
  }
}
