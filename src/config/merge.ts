import { ld } from "lodash/mod.ts";

export function mergeOptions<T>(...configs: T[]): T {
  return ld.mergeWith(configs[0], ...configs.slice(1), optionMerger);
}

function optionMerger(objValue: unknown, srcValue: unknown) {
  if (ld.isArray(objValue) && ld.isArray(srcValue)) {
    const combined = (objValue as Array<unknown>).concat(
      srcValue as Array<unknown>,
    );
    return ld.uniqBy(combined, ld.toString);
  }
}
