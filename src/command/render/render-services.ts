/*
 * render-services.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { kRenderServicesLifetime } from "../../config/constants.ts";
import { createNamedLifetime, getNamedLifetime } from "../../core/lifetimes.ts";
import { createTempContext } from "../../core/temp.ts";
import { createExtensionContext } from "../../extension/extension.ts";
import { NotebookContext } from "../../render/notebook/notebook-types.ts";
import { RenderServiceWithLifetime } from "./types.ts";

export function renderServices(
  notebook: NotebookContext,
): RenderServiceWithLifetime {
  const temp = createTempContext();
  const extension = createExtensionContext();

  if (getNamedLifetime(kRenderServicesLifetime)) {
    return {
      temp,
      extension,
      notebook,
      lifetime: getNamedLifetime(kRenderServicesLifetime),
      cleanup: () => {},
    };
  } else {
    const lifetime = createNamedLifetime(kRenderServicesLifetime);
    lifetime.attach(temp);
    lifetime.attach(notebook);
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

export function withRenderServices<T>(
  notebook: NotebookContext,
  fn: (services: RenderServiceWithLifetime) => Promise<T>,
) {
  const services = renderServices(notebook);
  return fn(services).finally(() => {
    services.cleanup();
  });
}
