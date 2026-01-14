import { expect, Locator, PlaywrightTestOptions } from "@playwright/test";

export const getUrl = (path: string) => {
  return `http://127.0.0.1:8080/${path}`;
};

// deno-lint-ignore no-explicit-any
export const ojsVal = async (page: any, name: string) => {
  return await page.evaluate(async (name: string) => {
    const fieldsExist = (obj, names, timeout = 1000) => {
      names = names.slice();
      // deno-lint-ignore no-explicit-any
      let accept: any, reject: any;
      const promise = new Promise((a, r) => {
        accept = a;
        reject = r;
      });
      const delay = 100;
      if (names.length === 0) {
        accept(obj);
        return promise;
      }
      let name = names[0];
      function tick() {
        if (Object.prototype.hasOwnProperty.call(obj, name)) {
          names = names.slice(1);
          if (names.length === 0) {
            accept(obj);
          } else {
            obj = obj[name];
            name = names[0];
            //deno-lint-ignore no-window-prefix
            window.setTimeout(tick, delay);
          }
        } else {
          timeout -= delay;
          if (timeout < 0) {
            reject();
          } else {
            //deno-lint-ignore no-window-prefix
            window.setTimeout(tick, delay);
          }
        }
      }
      tick();
      return promise;
    };

    // deno-lint-ignore no-explicit-any
    await fieldsExist(window, ["_ojs", "runtime"]);
    // await new Promise((resolve) => setTimeout(resolve, 3000));
    // deno-lint-ignore no-explicit-any
    await (window as any)._ojs.runtime.finishInterpreting();
    // deno-lint-ignore no-explicit-any
    const val = await (window as any)._ojs.runtime.value(name);
    return val;
  }, name);
};

// deno-lint-ignore no-explicit-any
export const ojsRuns = async (page: any) => {
  return await page.evaluate(async () => {
    const fieldsExist = (obj, names, timeout = 1000) => {
      names = names.slice();
      // deno-lint-ignore no-explicit-any
      let accept: any, reject: any;
      const promise = new Promise((a, r) => {
        accept = a;
        reject = r;
      });
      const delay = 100;
      if (names.length === 0) {
        accept(obj);
        return promise;
      }
      let name = names[0];
      function tick() {
        if (Object.prototype.hasOwnProperty.call(obj, name)) {
          names = names.slice(1);
          if (names.length === 0) {
            accept(obj);
          } else {
            obj = obj[name];
            name = names[0];
            //deno-lint-ignore no-window-prefix
            window.setTimeout(tick, delay);
          }
        } else {
          timeout -= delay;
          if (timeout < 0) {
            reject();
          } else {
            //deno-lint-ignore no-window-prefix
            window.setTimeout(tick, delay);
          }
        }
      }
      tick();
      return promise;
    };

    // deno-lint-ignore no-explicit-any
    await fieldsExist(window, ["_ojs", "runtime"]);
    // await new Promise((resolve) => setTimeout(resolve, 3000));
    // deno-lint-ignore no-explicit-any
    await (window as any)._ojs.runtime.finishInterpreting();
    return true;
  });
};

export const checkClick = async (page: any, locator: any) => {
  let error = false;
  page.on("pageerror", (_e) => {
    error = true;
  });
  try {
    await locator.click();
  } catch (_e) {
    error = true;
  }
  return !error;
};

export type RGBColor = {
  red: number;
  green: number;
  blue: number;
  alpha?: number;
};

export type HexColor = string;

export function isRGBColor(color: any): color is RGBColor {
  return (
    typeof color === 'object' && 
    'red' in color && 
    'green' in color && 
    'blue' in color
  );
}

export function isHexColor(color: any): color is HexColor {
  return (
    typeof color === 'string' &&
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
  );
}

export async function checkColor(element, cssProperty, color: RGBColor | HexColor) {
  let colorString: string;
  // Check if the color is an RGBColor object or a string
  if (isRGBColor(color)) {
    colorString = color.alpha !== undefined
      ? `rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`
      : `rgb(${color.red}, ${color.green}, ${color.blue})`;
  } else if (isHexColor(color)) {
    colorString = color as string;
  } else {
    throw new Error('Invalid color format. Use either RGBColor or HexColor.');
  }
  // Check the CSS property
  await expect(element).toHaveCSS(cssProperty, colorString);
}

export function asRGB(red: number, green: number, blue: number, alpha?: number): RGBColor {
  return { red, green, blue, alpha };
}

export function hexToRgb(hex: string): RGBColor {
  // Remove the # if present
  hex = hex.replace(/^#/, '');
  
  let r: number, g: number, b: number, a: number | undefined = undefined; 
  
  if (hex.length === 3) {
    // Handle shorthand #RGB format
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    // Handle #RRGGBB format
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    // Handle #RRGGBBAA format
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16);
  } else {
    throw new Error('Invalid hex color format');
  }
  return (asRGB(r, g, b, a));
}

export async function getCSSProperty(loc: Locator, variable: string, asNumber = false): Promise<string | number> {
  const property = await loc.evaluate((element, variable) =>
    window.getComputedStyle(element).getPropertyValue(variable),
    variable
  );
  if (asNumber) {
    return parseFloat(property);
  } else {
    return property;
  }
}

export async function checkCSSproperty(loc1: Locator, loc2: Locator, property: string, asNumber: false | true, checkType: 'identical' | 'similar', factor: number = 1) {
  let loc1Property = await getCSSProperty(loc1, property, asNumber);
  let loc2Property = await getCSSProperty(loc2, property, asNumber);
  if (checkType === 'identical') {
    await expect(loc2).toHaveCSS(property, loc1Property as string);
  } else {
    await expect(loc1Property).toBeCloseTo(loc2Property as number * factor);
  }
}

export async function checkFontSizeIdentical(loc1: Locator, loc2: Locator) {
  await checkCSSproperty(loc1, loc2, 'font-size', false, 'identical');
}

export async function checkFontSizeSimilar(loc1: Locator, loc2: Locator, factor: number = 1) {
  await checkCSSproperty(loc1, loc2, 'font-size', true, 'similar', factor);
}

export async function checkColorIdentical(loc1: Locator, loc2: Locator, property: string) {
  await checkCSSproperty(loc1, loc2, property, false, 'identical');
}

export async function checkBorderProperties(element: Locator, side: string, color: RGBColor, width: string) {
  await checkColor(element, `border-${side}-color`, color);
  await expect(element).toHaveCSS(`border-${side}-width`, width);
}

export async function checkBackgroundColorProperty(element: Locator, color: RGBColor) {
  await checkColor(element, `background-color`, color);
}

export function useDarkLightMode(mode: 'dark' | 'light'): Partial<PlaywrightTestOptions> {
  return {
    colorScheme: mode
  };
}