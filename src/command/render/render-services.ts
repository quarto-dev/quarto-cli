/*
 * render-services.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { createNamedLifetime, getNamedLifetime } from "../../core/lifetimes.ts";
import { createTempContext } from "../../core/temp.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import { notebookContext } from "../../quarto-core/notebook/notebook-context.ts";
import { NotebookContext } from "../../quarto-core/notebook/notebook-types.ts";
import { RenderServiceWithLifetime } from "./types.ts";

export function renderServices(
  notebookCtx?: NotebookContext,
): RenderServiceWithLifetime {
  const temp = createTempContext();
  const extension = createExtensionContext();
  const notebook = notebookCtx || notebookContext();

  if (getNamedLifetime("render-services")) {
    return {
      temp,
      extension,
      notebook,
      lifetime: getNamedLifetime("render-services"),
      cleanup: () => {},
    };
  } else {
    const lifetime = createNamedLifetime("render-services");
    lifetime.attach(temp);
    return {
      temp,
      extension,
      notebook,
      lifetime,
      cleanup: () => {
        lifetime.cleanup();
      },
    };
  }
}
