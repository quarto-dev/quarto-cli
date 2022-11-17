/*
* localization.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { Format } from "./types.ts";

export function localizedString(
  format: Format,
  key: string,
  options?: string[],
) {
  if (options) {
    let formattedStr = format.language[key] as string;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      formattedStr = formattedStr.replace(`{${i}}`, option);
    }
    return formattedStr;
  } else {
    return format.language[key] as string;
  }
}
