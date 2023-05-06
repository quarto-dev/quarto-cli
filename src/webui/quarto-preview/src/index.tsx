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



import { connectToServer } from './server/connection';
import { navigationHandler } from './server/navigation';
import { progressHandler } from './server/progress';

import { handleExternalLinks } from "./frame/links";
import { handleRevealMessages } from "./frame/reveal";
import { handleViewerMessages } from "./frame/viewer";
import { handleCommands } from './frame/commands';

import './ui/fluent.css'

export interface Options {
  origin: string | null,
  search: string | null,
  inputFile: string | null,
  isPresentation: boolean;
}

function init(options: Options) {
  
  try {

    // detect dark mode
    const darkMode = detectDarkMode();

    // server connection
    const disconnect = connectToServer([
      progressHandler(darkMode),
      navigationHandler()
    ]);

    // handle commands
    handleCommands();

    // handle external link clicks
    if (options.origin && options.search) {
      handleExternalLinks(options.origin, options.search);
    }

    // handle messages as approprate for format
    if (options.isPresentation) {
      handleRevealMessages(disconnect)
    } else {
      handleViewerMessages();
    }

  } catch (error) {
    console.error(error);
  }
}

function detectDarkMode() {
  if (document.body.classList.contains("quarto-dark")) {
    return true;
  } else {
    const params = new URLSearchParams(window.location.search);
    return params.get("quartoPreviewThemeCategory") === "dark";
  }
}

export { init }




