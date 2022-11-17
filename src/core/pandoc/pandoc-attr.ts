/*
* pandoc-attr.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { PandocAttr } from "./types.ts";

export function pandocAttrParseText(attr: string): PandocAttr | null {
  attr = attr.trim();

  let id = "";
  const classes: string[] = [];
  let remainder = "";

  let current = "";
  const resolveCurrent = () => {
    const resolve = current;
    current = "";

    if (resolve.length === 0) {
      return true;
    } else if (resolve.startsWith("#")) {
      if (id.length === 0 && resolve.length > 1) {
        id = resolve.substr(1);
        return true;
      } else {
        return false;
      }
    } else if (resolve.startsWith(".")) {
      if (resolve.length > 1) {
        classes.push(resolve.substr(1));
        return true;
      } else {
        return false;
      }
    } else if (resolve === "-") {
      classes.push("unnumbered");
      return true;
    } else {
      remainder = resolve;
      return true;
    }
  };

  for (let i = 0; i < attr.length; i++) {
    let inQuotes = false;
    const ch = attr[i];
    inQuotes = ch === '"' ? !inQuotes : inQuotes;
    if (ch !== " " && !inQuotes) {
      current += ch;
    } else if (resolveCurrent()) {
      // if we have a remainder then the rest of the string is the remainder
      if (remainder.length > 0) {
        remainder = remainder + attr.substr(i);
        break;
      }
    } else {
      return null;
    }
  }

  if (resolveCurrent()) {
    if (id.length === 0 && classes.length === 0) {
      remainder = attr;
    }
    return {
      id,
      classes,
      keyvalue: remainder.length > 0
        ? pandocAttrKeyvalueFromText(remainder, " ")
        : [],
    };
  } else {
    return null;
  }
}

export function pandocAttrKeyvalueFromText(
  text: string,
  separator: " " | "\n",
): Array<[string, string]> {
  // if the separator is a space then convert unquoted spaces to newline
  if (separator === " ") {
    let convertedText = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      let ch = text.charAt(i);
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === " " && !inQuotes) {
        ch = "\n";
      }
      convertedText += ch;
    }
    text = convertedText;
  }

  const lines = text.trim().split("\n");
  return lines.map((line) => {
    const parts = line.trim().split("=");
    return [parts[0], (parts[1] || "").replace(/^"/, "").replace(/"$/, "")];
  });
}
