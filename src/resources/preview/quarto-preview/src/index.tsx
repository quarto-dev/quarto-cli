/*
 * index.tsx
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


import { initializeFluent } from './fluent';

import { handleExternalLinks } from "./links";
import { handleRevealMessages } from "./reveal";
import { handleViewerMessages } from "./viewer";

import { initializeDevserverCore } from "./core";

export interface Options {
  origin: string | null,
  search: string | null,
  inputFile: string | null,
  isPresentation: boolean;
}

async function init(options: Options) {
  try {

    // intialize fluent 
    initializeFluent();

    // devserver core
    const closeDevServer = initializeDevserverCore();

    // handle external link clicks
    if (options.origin && options.search) {
      handleExternalLinks(options.origin, options.search);
    }

    // handle messages
    if (options.isPresentation) {
      handleRevealMessages(closeDevServer)
    } else {
      handleViewerMessages();
    }
  } catch (error) {
    console.error(error);
  }
}


export { init }




