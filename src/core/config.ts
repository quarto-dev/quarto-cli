/*
 * config.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import * as ld from "./lodash.ts";

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
      if (typeof value === "function") {
        return globalThis.crypto.randomUUID();
      } else {
        return JSON.stringify(value);
      }
    });
  }
}

// the camelToKebab transform is not well-defined for
// sequences of uppercase characters ("URL" being the
// example that comes up in practice). For example,
// the string "isURLHTML" can't be transformed to
// the "correct" "is-url-html" because it's not clear
// where the hyphens should go. As a heuristic,
// we assume that a sequence of uppercase characters
// that is followed by a lowercase character should
// be treated as a single word, except for the last
// uppercase character if it's followed by subsequent
// lowercase characters. So "isURLHTML" becomes
// "is-urlhtml", but "isURLHTMLString" becomes
// "is-urlhtml-string".
export function camelToKebab(camel: string) {
  camel = camel.replace(/([A-Z])([A-Z]+)$/g, function (_, p1, p2) {
    return p1 + p2.toLowerCase();
  });
  camel = camel.replaceAll(/([A-Z])([A-Z]+)([A-Z])/g, function (_, p1, p2, p3) {
    return p1 + p2.toLowerCase() + p3;
  });
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
