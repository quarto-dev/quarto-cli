/*
* website-utils.ts
*
* Copyright (C) 2022 Posit Software, PBC
*
*/

import { Element } from "../../../core/deno-dom.ts";

export function removeChapterNumber(item: Element) {
  const numberSpan = item.querySelector(".chapter-number");
  const titleSpan = item.querySelector(".chapter-title");
  if (numberSpan && titleSpan) {
    item.innerHTML = "";
    item.appendChild(titleSpan);
  }
}
