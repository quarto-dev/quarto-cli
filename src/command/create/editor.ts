/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { CreateResult } from "./cmd-types.ts";

import { which } from "../../core/path.ts";
import {
  isPositronTerminal,
  isRStudioTerminal,
  isVSCodeTerminal,
} from "../../core/platform.ts";

import { basename, dirname, join } from "../../deno_ral/path.ts";
import { existsSync } from "../../deno_ral/fs.ts";
import { isMac, isWindows } from "../../deno_ral/platform.ts";

export interface Editor {
  // A short, command line friendly id
  id: string;

  // A display name
  name: string;

  // Whether this is being run from within the editor
  // (e.g. from the vscode or rstudio terminal)
  inEditor: boolean;

  // Function that can be called to open the matched
  // artifact in the editor
  open: () => Promise<void>;
}

export const kEditorInfos: EditorInfo[] = [
  positronEditorInfo(),
  vscodeEditorInfo(),
  rstudioEditorInfo(),
];

export async function scanForEditors(
  editorInfos: EditorInfo[],
  createResult: CreateResult,
) {
  const editors: Editor[] = [];
  for (const editorInfo of editorInfos) {
    const editorPath = await findEditorPath(editorInfo.actions);
    if (editorPath) {
      editors.push({
        id: editorInfo.id,
        name: editorInfo.name,
        open: editorInfo.open(editorPath, createResult),
        inEditor: editorInfo.inEditor,
      });
    }
  }
  return editors;
}

interface EditorInfo {
  // The identifier for this editor
  id: string;

  // The name of this editor
  name: string;

  // Actions that are used to scan for this editor
  actions: ScanAction[];

  // Whether this is being run from within the editor
  // (e.g. from the vscode or rstudio terminal)
  inEditor: boolean;

  // Uses a path and artifact path to provide a function
  // that can be used to open this editor to the given artifact
  open: (path: string, createResult: CreateResult) => () => Promise<void>;
}

interface ScanAction {
  action: "path" | "which" | "env";
  arg: string;
  filter?: (path: string) => string;
}

function vscodeEditorInfo(): EditorInfo {
  const editorInfo: EditorInfo = {
    id: "vscode",
    name: "vscode",
    open: (path: string, createResult: CreateResult) => {
      const artifactPath = createResult.path;
      const cwd = Deno.statSync(artifactPath).isDirectory
        ? artifactPath
        : dirname(artifactPath);

      return async () => {
        const p = Deno.run({
          cmd: [path, artifactPath],
          cwd,
        });
        await p.status();
      };
    },
    inEditor: isVSCodeTerminal(),
    actions: [],
  };

  if (isWindows) {
    editorInfo.actions.push({
      action: "which",
      arg: "code.exe",
    });
    const pathActions = windowsAppPaths("Microsoft VS Code", "code.exe").map(
      (path) => {
        return {
          action: "path",
          arg: path,
        } as ScanAction;
      },
    );
    editorInfo.actions.push(...pathActions);
  } else if (isMac) {
    editorInfo.actions.push({
      action: "which",
      arg: "code",
    });

    const pathActions = macosAppPaths(
      "Visual Studio Code.app/Contents/Resources/app/bin/code",
    ).map((path) => {
      return {
        action: "path",
        arg: path,
      } as ScanAction;
    });
    editorInfo.actions.push(...pathActions);
  } else {
    editorInfo.actions.push({
      action: "which",
      arg: "code",
    });
    editorInfo.actions.push({
      action: "path",
      arg: "/snap/bin/code",
    });
  }
  return editorInfo;
}

function positronEditorInfo(): EditorInfo {
  const editorInfo: EditorInfo = {
    id: "positron",
    name: "positron",
    open: (path: string, createResult: CreateResult) => {
      const artifactPath = createResult.path;
      const cwd = Deno.statSync(artifactPath).isDirectory
        ? artifactPath
        : dirname(artifactPath);

      return async () => {
        const p = Deno.run({
          cmd: [path, artifactPath],
          cwd,
        });
        await p.status();
      };
    },
    inEditor: isPositronTerminal(),
    actions: [],
  };

  if (isWindows) {
    editorInfo.actions.push({
      action: "which",
      arg: "Positron.exe",
    });
    const pathActions = windowsAppPaths("Positron", "Positron.exe").map(
      (path) => {
        return {
          action: "path",
          arg: path,
        } as ScanAction;
      },
    );
    editorInfo.actions.push(...pathActions);
  } else if (isMac) {
    editorInfo.actions.push({
      action: "which",
      arg: "positron",
    });

    const pathActions = macosAppPaths(
      "Positron.app/Contents/Resources/app/bin/code",
    ).map((path) => {
      return {
        action: "path",
        arg: path,
      } as ScanAction;
    });
    editorInfo.actions.push(...pathActions);
  } else {
    editorInfo.actions.push({
      action: "which",
      arg: "positron",
    });
  }
  return editorInfo;
}

function rstudioEditorInfo(): EditorInfo {
  const editorInfo: EditorInfo = {
    id: "rstudio",
    name: "RStudio",
    open: (path: string, createResult: CreateResult) => {
      return async () => {
        const artifactPath = createResult.path;
        // The directory that the artifact is in
        const cwd = Deno.statSync(artifactPath).isDirectory
          ? artifactPath
          : dirname(artifactPath);

        // Write an rproj file for RStudio and open that
        const artifactName = basename(artifactPath);
        const rProjPath = join(cwd, `${artifactName}.Rproj`);
        Deno.writeTextFileSync(rProjPath, kRProjContents);

        const cmd = path.endsWith(".app") && isMac
          ? ["open", "-na", path, "--args", rProjPath]
          : [path, rProjPath];

        const p = Deno.run({
          cmd,
          cwd,
        });
        await p.status();
      };
    },
    inEditor: isRStudioTerminal(),
    actions: [],
  };

  const rstudioExe = "rstudio.exe";
  if (isWindows) {
    editorInfo.actions.push({
      action: "env",
      arg: "RS_RPOSTBACK_PATH",
      filter: (path: string) => {
        return join(dirname(path), rstudioExe);
      },
    });

    const paths = windowsAppPaths(join("RStudio", "bin"), rstudioExe).map(
      (path) => {
        return {
          action: "path",
          arg: path,
        } as ScanAction;
      },
    );
    editorInfo.actions.push(...paths);
  } else if (isMac) {
    const paths = macosAppPaths("RStudio.app").map((path) => {
      return {
        action: "path",
        arg: path,
      } as ScanAction;
    });
    editorInfo.actions.push(...paths);
  } else {
    editorInfo.actions.push({
      action: "env",
      arg: "RS_RPOSTBACK_PATH",
      filter: (path: string) => {
        return join(dirname(path), rstudioExe);
      },
    });

    editorInfo.actions.push({
      action: "path",
      arg: "/usr/lib/rstudio/bin/rstudio",
    });
    editorInfo.actions.push({
      action: "which",
      arg: "rstudio",
    });
  }
  return editorInfo;
}

// Write an rproj file to the cwd and open that
const kRProjContents = `Version: 1.0

RestoreWorkspace: Default
SaveWorkspace: Default
AlwaysSaveHistory: Default

EnableCodeIndexing: Yes
UseSpacesForTab: Yes
NumSpacesForTab: 2
Encoding: UTF-8

RnwWeave: Knitr
LaTeX: pdfLaTeX`;

async function findEditorPath(
  actions: ScanAction[],
): Promise<string | undefined> {
  for (const action of actions) {
    const filter = action.filter || ((path) => {
      return path;
    });
    switch (action.action) {
      case "which": {
        const path = await which(action.arg);
        if (path) {
          return filter(path);
        }
        break;
      }
      case "path":
        if (existsSync(action.arg)) {
          return filter(action.arg);
        }
        break;
      case "env": {
        const envValue = Deno.env.get(action.arg);
        if (envValue) {
          return filter(envValue);
        }
      }
    }
  }
  // Couldn't find it, give up
  return undefined;
}

function windowsAppPaths(folderName: string, command: string) {
  const paths: string[] = [];
  // Scan local app folder
  const localAppData = Deno.env.get("LOCALAPPDATA");
  if (localAppData) {
    paths.push(join(localAppData, "Programs", folderName, command));
  }

  // Scan program files folder
  const programFiles = Deno.env.get("PROGRAMFILES");
  if (programFiles) {
    paths.push(join(programFiles, folderName, command));
  }

  // Scan program files x86
  const programFilesx86 = Deno.env.get("PROGRAMFILES(X86)");
  if (programFilesx86) {
    paths.push(join(programFilesx86, folderName, command));
  }

  return paths;
}

function macosAppPaths(appName: string) {
  const paths: string[] = [];
  paths.push(join("/Applications", appName));
  const home = Deno.env.get("HOME");
  if (home) {
    paths.push(join(home, "Applications", appName));
  }
  return paths;
}
