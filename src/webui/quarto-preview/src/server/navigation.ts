/*
 * navigation.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

export function navigationHandler() {

  return () => {
    const normalizeTarget = (target: string) => {
      return target.replace(/\/index\.html/, "/")
    };
    
    return (ev: MessageEvent<string>) : boolean => {
      if (ev.data.startsWith('reload')) {
        let target = normalizeTarget(ev.data.replace(/^reload/, ""));
        // prepend proxy path to target if we have one
        if (target) {
          const pathPrefix = 
            window.location.pathname.match(/^.*?\/p\/\w+\//) ||
            window.location.pathname.match(/^.*?\/user\/[\w\d]+\/proxy\/\d+\//);
          if (pathPrefix) {
            target = pathPrefix + target.slice(1);
          }
        }
        if (target && (target !== normalizeTarget(window.location.pathname))) {
          window.location.replace(target);
        } else {
          window.location.reload();
        }
        return true;
      } else {
        return false;
      }
    }
  }
}

