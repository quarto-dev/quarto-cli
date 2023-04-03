/*
 * render-services.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { createNamedLifetime, getNamedLifetime } from "../../core/lifetimes.ts";
import { createTempContext } from "../../core/temp.ts";
import { createExtensionContext } from "../../extension/extension.ts";

export function renderServices() {
  const temp = createTempContext();
  const extension = createExtensionContext();

  if (getNamedLifetime("render-services")) {
    return {
      temp,
      extension,
      lifetime: getNamedLifetime("render-services"),
      cleanup: () => {},
    };
  } else {
    const lifetime = createNamedLifetime("render-services");
    lifetime.attach(temp);

    return {
      temp,
      extension,
      lifetime,
      cleanup: () => {
        lifetime.cleanup();
      },
    };
  }
}
