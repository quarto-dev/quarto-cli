import { ld } from "lodash/mod.ts";

export function mergeConfigs<T>(...configs: T[]): T {
  return ld.mergeWith(configs[0], ...configs.slice(1), configMerger);
}

function configMerger(objValue: unknown, srcValue: unknown) {
  if (ld.isArray(objValue) && ld.isArray(srcValue)) {
    const combined = (objValue as Array<unknown>).concat(
      srcValue as Array<unknown>,
    );
    return ld.uniqBy(combined, ld.toString);
  }
}
