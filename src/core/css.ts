/*
* css.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export function asCssFont(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  } else {
    const fontFamily = String(value)
      .split(",")
      .map((font) => {
        font = font.trim();
        if (font.includes(" ")) {
          font = `"${font}"`;
        }
        return font;
      })
      .filter((font) => font.length > 0)
      .join(", ");
    return `${fontFamily}`;
  }
}

export function asCssNumber(value: unknown): string | undefined {
  if (typeof (value) === "number") {
    return String(value);
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    const match = str.match(/(^[0-9]*)/);
    if (match) {
      return match[1];
    } else {
      return undefined;
    }
  }
}

export function asCssSize(value: unknown): string | undefined {
  if (typeof (value) === "number") {
    if (value === 0) {
      return "0";
    } else {
      return value + "px";
    }
  } else if (!value) {
    return undefined;
  } else {
    const str = String(value);
    if (str !== "0" && !str.match(/\w$/)) {
      return str + "px";
    } else {
      return str;
    }
  }
}

export function asCssColor(value: unknown): string | undefined {
  if (typeof (value) === "string") {
    return value;
  }
}
