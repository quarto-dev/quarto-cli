/*
* hash.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import blueimpMd5 from "blueimpMd5";

export function md5Hash(content: string) {
  return blueimpMd5(content);
}
