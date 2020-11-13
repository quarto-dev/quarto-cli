/*
* resources.ts
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

import { join } from "path/mod.ts";
import { getenv } from "./env.ts";

export function resourcePath(resource?: string): string {
  const quartoPath = getenv("QUARTO_PATH");
  if (resource) {
  	return join(quartoPath, "share", resource);
  } else {
  	return join(quartoPath, "share");
  }
}

export function binaryPath(binary: string): string {
  const quartoPath = getenv("QUARTO_PATH");
  return join(quartoPath, binary);
}

export function rPath(file: string): string {
  const rPath = getenv("R_PATH");
  return join(rPath, file);
}
