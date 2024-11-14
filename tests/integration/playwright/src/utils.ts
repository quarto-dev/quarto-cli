import { expect, Locator } from "@playwright/test";

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
};

export async function checkColor(element, cssProperty, rgbColors: RGBColor) {
  await expect(element).toHaveCSS(cssProperty, `rgb(${rgbColors.red}, ${rgbColors.green}, ${rgbColors.blue})`);
}

export function asRGB(red: number, green: number, blue: number): RGBColor {
  return { red, green, blue };
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


export async function checkFontSizeIdentical(loc1: Locator, loc2: Locator) {
  const loc1FontSize = await getCSSProperty(loc1, 'font-size', false) as string;
  await expect(loc2).toHaveCSS('font-size', loc1FontSize);
}

export async function checkFontSizeSimilar(loc1: Locator, loc2: Locator, factor: number = 1) {
  const loc1FontSize = await getCSSProperty(loc1, 'font-size', true) as number;
  const loc2FontSize = await getCSSProperty(loc2, 'font-size', true) as number;
  await expect(loc1FontSize).toBeCloseTo(loc2FontSize * factor);
}