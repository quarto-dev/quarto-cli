/*
 * index.tsx
 *
 * Copyright (C) 2023 Posit Software, PBC
 */

import { connectToServer } from "./server/connection";
import { navigationHandler } from "./server/navigation";
import { progressHandler } from "./server/progress";

import { handleExternalLinks } from "./frame/links";
import { handleMecaLinks } from "./frame/meca";
import { handleRevealMessages } from "./frame/reveal";
import { handleViewerMessages } from "./frame/viewer";
import { handleCommands } from "./frame/commands";

import "./ui/fluent.css";

export interface Options {
  origin: string | null;
  search: string | null;
  inputFile: string | null;
  isPresentation: boolean;
}

// Store the current options
let currentOptions: Options | null = null;

function init(options: Options) {
  // Store the options for export
  currentOptions = options;

  try {
    // detect dark mode
    const darkMode = detectDarkMode();

    // server connection
    const disconnect = connectToServer([
      progressHandler(darkMode),
      navigationHandler(),
    ]);

    // handle commands
    handleCommands();

    // handle external link clicks
    if (options.origin && options.search) {
      handleExternalLinks(options.origin, options.search);
    }

    // handle Links to MECA archives (for our Manuscript project type)
    handleMecaLinks(darkMode);

    // handle messages as approprate for format
    if (options.isPresentation) {
      handleRevealMessages(disconnect);
    } else {
      handleViewerMessages(options.inputFile);
    }

    // Dispatch event when initialized
    const event = new CustomEvent("quarto-preview-initialized", {
      detail: options,
    });

    document.dispatchEvent(event);
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

// Export the current options
function getOptions() {
  return currentOptions;
}

export { init, getOptions };
