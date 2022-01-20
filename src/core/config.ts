/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import * as ld from "./lodash.ts";

import { generate as generateUuid } from "uuid/v4.ts";

export function mergeConfigs<T>(config: T, ...configs: Array<unknown>): T {
  // copy all configs so we don't mutate them
  config = ld.cloneDeep(config);
  configs = ld.cloneDeep(configs);

  return ld.mergeWith(
    config,
    ...configs,
    mergeArrayCustomizer,
  );
}

export function mergeArrayCustomizer(objValue: unknown, srcValue: unknown) {
  if (ld.isArray(objValue) || ld.isArray(srcValue)) {
    // handle nulls
    if (!objValue) {
      return srcValue;
    } else if (!srcValue) {
      return objValue;
      // coerce scalers to array
    } else {
      if (!ld.isArray(objValue)) {
        objValue = [objValue];
      }
      if (!ld.isArray(srcValue)) {
        srcValue = [srcValue];
      }
    }

    const combined = (objValue as Array<unknown>).concat(
      srcValue as Array<unknown>,
    );
    return ld.uniqBy(combined, (value: unknown) => {
      if (typeof (value) === "function") {
        return generateUuid();
      } else {
        return JSON.stringify(value);
      }
    });
  }
}

export function camelToKebab(camel: string) {
  const kebab: string[] = [];
  for (let i = 0; i < camel.length; i++) {
    const ch = camel.charAt(i);
    if (ch === ch.toUpperCase() && !/^\d+/.test(ch)) {
      if (i > 0) {
        kebab.push("-");
      }
      kebab.push(ch.toLowerCase());
    } else {
      kebab.push(ch);
    }
  }
  return kebab.join("");
}

export function kebabToCamel(kebab: string, leadingUppercase = false) {
  const camel: string[] = [];
  for (let i = 0; i < kebab.length; i++) {
    const ch = kebab.charAt(i);
    if (ch === "-") {
      camel.push(kebab.charAt(++i).toUpperCase());
    } else if ((i === 0) && leadingUppercase) {
      camel.push(ch.toUpperCase());
    } else {
      camel.push(ch);
    }
  }
  return camel.join("");
}
