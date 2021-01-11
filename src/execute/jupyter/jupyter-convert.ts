/*
* jupyter-convert.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export interface JupyterKernelspec {
  name: string;
  language: string;
  display_name: string;
}

export async function jupyterMdToIpynb(
  input: string,
  output: string,
  kernelspec: JupyterKernelspec,
) {
  // read the file into lines
  const lines = (await Deno.readTextFile(input)).split(/\r?\n/);
}
