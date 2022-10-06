/*
* cmd.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { join } from "path/mod.ts";
import { existsSync } from "fs/mod.ts";
import { which } from "../../core/path.ts";
import { dirname } from "path/win32.ts";

export interface Editor {
  // A short, command line friendly id
  id: string;

  // A display name
  name: string;

  // The cmd to open the editor
  cmd: string[];

  // The working directory to use when opening the editor
  cwd?: string;
}

export const kEditorInfos: EditorInfo[] = [
  vscodeEditorInfo(),
  rstudioEditorInfo(),
];

export async function scanForEditors(
  editorInfos: EditorInfo[],
  artifactPath: string,
) {
  const editors: Editor[] = [];
  for (const editorInfo of editorInfos) {
    const editorPath = await findEditorPath(editorInfo.actions);
    if (editorPath) {
      editors.push({
        id: editorInfo.id,
        name: editorInfo.name,
        cmd: editorInfo.cmd(editorPath, artifactPath),
        cwd: editorInfo.cwd(artifactPath),
      });
    }
  }
  return editors;
}

interface EditorInfo {
  id: string;
  name: string;
  actions: ScanAction[];
  cmd: (path: string, artifactPath: string) => string[];
  cwd: (artifactPath: string) => string | undefined;
}

interface ScanAction {
  action: "path" | "which";
  arg: string;
}

function vscodeEditorInfo(): EditorInfo {
  const editorInfo: EditorInfo = {
    id: "vscode",
    name: "Visual Studio Code",
    cmd: (path: string, artifactPath: string) => {
      return [path, artifactPath];
    },
    cwd: (artifactPath: string) => {
      if (Deno.statSync(artifactPath).isDirectory) {
        return artifactPath;
      } else {
        return dirname(artifactPath);
      }
    },
    actions: [],
  };

  if (Deno.build.os === "windows") {
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
  } else if (Deno.build.os === "darwin") {
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

function rstudioEditorInfo(): EditorInfo {
  const editorInfo: EditorInfo = {
    id: "rstudio",
    name: "RStudio",
    cmd: (path: string, artifactPath: string) => {
      if (path.endsWith(".app") && Deno.build.os === "darwin") {
        return ["open", "-na", path, "--args", artifactPath];
      } else {
        return [path];
      }
    },
    cwd: (artifactPath: string) => {
      if (Deno.statSync(artifactPath).isDirectory) {
        return artifactPath;
      } else {
        return dirname(artifactPath);
      }
    },
    actions: [],
  };

  if (Deno.build.os === "windows") {
    const paths = windowsAppPaths("RStudio", "rstudio.exe").map((path) => {
      return {
        action: "path",
        arg: path,
      } as ScanAction;
    });
    editorInfo.actions.push(...paths);
  } else if (Deno.build.os === "darwin") {
    const paths = macosAppPaths("RStudio.app").map((path) => {
      return {
        action: "path",
        arg: path,
      } as ScanAction;
    });
    editorInfo.actions.push(...paths);
  } else {
    editorInfo.actions.push({
      action: "path",
      arg: "/usr/lib/rstudio/bin",
    });
    editorInfo.actions.push({
      action: "which",
      arg: "RStudio",
    });
  }
  return editorInfo;
}

async function findEditorPath(
  actions: ScanAction[],
): Promise<string | undefined> {
  for (const action of actions) {
    switch (action.action) {
      case "which": {
        const path = await which(action.arg);
        if (path) {
          return path;
        }
        break;
      }
      case "path":
        if (existsSync(action.arg)) {
          return action.arg;
        }
        break;
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
    paths.push(programFiles, folderName, command);
  }

  // Scan program files x86
  const programFilesx86 = Deno.env.get("PROGRAMFILES(X86)");
  if (programFilesx86) {
    paths.push(programFilesx86, folderName, command);
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
