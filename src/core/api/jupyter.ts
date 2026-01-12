// src/core/api/jupyter.ts

import { globalRegistry } from "./registry.ts";
import type { JupyterNamespace } from "./types.ts";

// Import implementations
import {
  executeResultEngineDependencies,
  executeResultIncludes,
  isJupyterNotebook,
  jupyterAssets,
  jupyterFromJSON,
  jupyterKernelspecFromMarkdown,
  jupyterToMarkdown,
  kJupyterNotebookExtensions,
  quartoMdToJupyter,
} from "../jupyter/jupyter.ts";
import {
  jupyterNotebookFiltered,
  markdownFromNotebookFile,
  markdownFromNotebookJSON,
} from "../jupyter/jupyter-filters.ts";
import { includesForJupyterWidgetDependencies } from "../jupyter/widgets.ts";
import { pythonExec } from "../jupyter/exec.ts";
import { jupyterCapabilities } from "../jupyter/capabilities.ts";
import { jupyterKernelspecForLanguage } from "../jupyter/kernels.ts";
import {
  jupyterCapabilitiesJson,
  jupyterCapabilitiesMessage,
  jupyterInstallationMessage,
  jupyterUnactivatedEnvMessage,
  pythonInstallationMessage,
} from "../jupyter/jupyter-shared.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "../jupyter/percent.ts";
import type { JupyterWidgetDependencies } from "../jupyter/types.ts";

// Register jupyter namespace
globalRegistry.register("jupyter", (): JupyterNamespace => {
  return {
    // 1. Notebook Detection & Introspection
    isJupyterNotebook,
    isPercentScript: isJupyterPercentScript,
    notebookExtensions: kJupyterNotebookExtensions,
    kernelspecFromMarkdown: jupyterKernelspecFromMarkdown,
    kernelspecForLanguage: jupyterKernelspecForLanguage,
    fromJSON: jupyterFromJSON,

    // 2. Notebook Conversion
    toMarkdown: jupyterToMarkdown,
    markdownFromNotebookFile,
    markdownFromNotebookJSON,
    percentScriptToMarkdown: markdownFromJupyterPercentScript,
    quartoMdToJupyter,

    // 3. Notebook Processing & Assets
    notebookFiltered: jupyterNotebookFiltered,
    assets: jupyterAssets,
    widgetDependencyIncludes: includesForJupyterWidgetDependencies,
    resultIncludes: (
      tempDir: string,
      dependencies?: JupyterWidgetDependencies,
    ) => {
      return executeResultIncludes(tempDir, dependencies) || {};
    },
    resultEngineDependencies: (dependencies?: JupyterWidgetDependencies) => {
      const result = executeResultEngineDependencies(dependencies);
      return result as Array<JupyterWidgetDependencies> | undefined;
    },

    // 4. Runtime & Environment
    pythonExec,
    capabilities: jupyterCapabilities,
    capabilitiesMessage: jupyterCapabilitiesMessage,
    capabilitiesJson: jupyterCapabilitiesJson,
    installationMessage: jupyterInstallationMessage,
    unactivatedEnvMessage: jupyterUnactivatedEnvMessage,
    pythonInstallationMessage,
  };
});
