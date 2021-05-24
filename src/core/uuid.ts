/*
* uuid.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { generate as generateUuid } from "uuid/v4.ts";

export function shortUuid() {
  return generateUuid().replaceAll("-", "").slice(0, 8);
}
