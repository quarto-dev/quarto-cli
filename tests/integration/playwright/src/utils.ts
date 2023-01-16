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
