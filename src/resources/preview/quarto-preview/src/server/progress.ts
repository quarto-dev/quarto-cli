/*
 * progress.ts
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

import { showProgressBar } from "../ui/ProgressBar";

export function progressHandler() {

  let hideProgress: VoidFunction | undefined;
 
  const hideProgressBar = () => {
    if (hideProgress) {
      hideProgress();
      hideProgress = undefined;
    }
  }

  return (ev: MessageEvent<string>) : boolean => {
    if (ev.data.startsWith('render:')) {
      hideProgressBar();
      if (ev.data.startsWith("render:start")) {
        hideProgress = showProgressBar();
      }
      return true;
    } else {
      return false;
    }
  };
}