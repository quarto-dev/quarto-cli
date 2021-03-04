/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ld } from "lodash/mod.ts";

export function mergeConfigs<T>(config: T, ...configs: Array<unknown>): T {
  // copy all configs so we don't mutate them
  config = ld.cloneDeep(config);
  configs = ld.cloneDeep(configs);

  return ld.mergeWith(
    config,
    ...configs,
    (objValue: unknown, srcValue: unknown) => {
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
        return ld.uniqBy(combined, JSON.stringify);
      }
    },
  );
}
