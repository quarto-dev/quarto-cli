/*
* config.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
* Unless you have received this program directly from RStudio pursuant
* to the terms of a commercial license agreement with RStudio, then
* this program is licensed to you under the terms of version 3 of the
* GNU General Public License. This program is distributed WITHOUT
* ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
* MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
* GPL (http://www.gnu.org/licenses/gpl-3.0.txt) for more details.
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
      if (ld.isArray(objValue) && ld.isArray(srcValue)) {
        const combined = (objValue as Array<unknown>).concat(
          srcValue as Array<unknown>,
        );
        return ld.uniqBy(combined, ld.toString);
      }
    },
  );
}
