/*
* format.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
*
*/
import { kMdExtensions } from "../config/constants.ts";

// pandoc output format
export interface Format {
  // figure defaults
  figure?: FormatFigure;
  // show code/warning/error defaults
  show?: FormatShow;
  // keep md, tex, etc.
  keep?: FormatKeep;
  // output attributes (e.g. file extension)
  output?: FormatOutput;
  // per-format pandoc metadata
  pandoc?: FormatPandoc;
  // per-format pandoc metadata (also allowed at root)
  [key: string]: unknown;
}

export interface FormatFigure {
  width?: number;
  height?: number;
  format?: "png" | "pdf";
  dpi?: number;
}

export interface FormatShow {
  code?: boolean;
  warning?: boolean;
  error?: boolean;
}

export interface FormatKeep {
  md?: boolean;
  yaml?: boolean;
  tex?: boolean;
}

export interface FormatOutput {
  ext?: string;
}

export interface FormatPandoc {
  from?: string;
  to?: string;
  [kMdExtensions]?: string;
  [key: string]: unknown;
}
