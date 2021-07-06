/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

// deno-lint-ignore-file camelcase

export interface JupyterCapabilities {
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  versionStr: string;
  execPrefix: string;
  executable: string;
  conda: boolean;
  pyLauncher: boolean;
  jupyter_core: string | null;
  nbformat: string | null;
  nbclient: string | null;
  ipykernel: string | null;
}

export interface JupyterCapabilitiesEx extends JupyterCapabilities {
  kernels?: JupyterKernelspec[];
  venv?: boolean;
}

export interface JupyterKernelspec {
  name: string;
  language: string;
  display_name: string;
}
