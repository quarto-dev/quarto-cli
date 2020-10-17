/*
* path.ts
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

import { basename, dirname, extname } from "path/mod.ts";

import { existsSync } from "fs/exists.ts";

export function removeIfExists(file: string) {
  if (existsSync(file)) {
    Deno.removeSync(file);
  }
}

export function dirAndStem(file: string) {
  return [
    dirname(file),
    basename(file, extname(file)),
  ];
}
