/*
* compile.ts
*
* Copyright (C) 2021 by RStudio, PBC
*
*/

import { Format } from "../../config/format.ts";

export interface ObserveableCompileOptions {
  source: string;
  format: Format;
  markdown: string;
  libDir?: string;
}

export interface ObservableCompileResult {
  markdown: string;
}

export function observableCompile(options: ObserveableCompileOptions) {
  return options.markdown;
}
