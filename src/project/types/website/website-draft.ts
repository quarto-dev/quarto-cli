/*
 * website-draft.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { HtmlPostProcessResult } from "../../../command/render/types.ts";
import { Document } from "../../../core/deno-dom.ts";

const kDraftStatus = "draft-remove";

export const websiteDraftPostProcessor = (
  doc: Document,
): Promise<HtmlPostProcessResult> => {
  const documentStatusEl = doc.querySelector("meta[name='quarto:status']");
  if (documentStatusEl !== null) {
    const status = documentStatusEl.getAttribute("content");
    if (status === kDraftStatus && doc.documentElement) {
      doc.documentElement.innerHTML = "";
    }
  }

  return Promise.resolve({
    resources: [],
    supporting: [],
  });
};
