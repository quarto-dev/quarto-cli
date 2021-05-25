/*
* convert.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  jupyterKernelspecFromFile,
  quartoMdToJupyter,
} from "../../core/jupyter/jupyter.ts";

export async function convertMarkdownToNotebook(
  file: string,
  includeIds: boolean,
) {
  const [kernelspec, metadata] = await jupyterKernelspecFromFile(file);
  const notebook = quartoMdToJupyter(
    file,
    kernelspec,
    metadata,
    includeIds,
  );
  return JSON.stringify(notebook, null, 2);
}

export function convertNotebookToMarkdown(file: string) {
  // TODO:  when converting from notebook to markdown, we do carry any id we find into metadata, however if the
  //        id matches the auto-converted label then we don't include id
  //         (could be command line flags to eliminate ids)

  return "";
}
