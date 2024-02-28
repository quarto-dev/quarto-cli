/*
 * pdfjs.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { basename, join } from "../deno_ral/path.ts";
import { md5Hash } from "./hash.ts";
import { viewerIFrameURL } from "./http-devserver.ts";
import { FileResponse } from "./http-types.ts";
import { contentType } from "./mime.ts";
import { pathWithForwardSlashes } from "./path.ts";
import { formatResourcePath } from "./resources.ts";
import { normalizeNewlines } from "./text.ts";

const kPdfJsDefaultFile = "compressed.tracemonkey-pldi-09.pdf";
const kPdfJsViewerToolbarButtonSelector = `.toolbarButton,
.dropdownToolbarButton,
.secondaryToolbarButton,
.overlayButton {`;

const kPdfJsViewerSidebarTransitionDurationPattern =
  /(--sidebar-transition-duration: )(\d+ms)/;

// NOTE: pdfjs uses the \pdftrailerid{} (if defined, and this macro only works for pdflatex)
// as the context for persisting user prefs. this is read in the "fingerprint" method of
// PDFDocument (on ~ line 12100 of pdf.worker.js). if we want to preserve the user's prefs
// (e.g. zoom level, sidebar, etc.) we need to provide this either by injecting \pdftrailerid
// into rendered pdfs or by patching PDFDocument to always return the same fingerprint
// (which is what we do below)

export const kPdfJsInitialPath = "web/viewer.html";

export function pdfJsBaseDir() {
  return formatResourcePath("pdf", "pdfjs");
}

export function pdfJsFileHandler(
  pdfFile: () => string,
  htmlHandler?: (
    file: string,
    req: Request,
  ) => Promise<FileResponse | undefined>,
) {
  let isViewer: boolean | undefined;

  return async (file: string, req: Request) => {
    // initialize isViewer w/ the first request
    if (isViewer === undefined) {
      isViewer = !!viewerIFrameURL(req);
    }

    // base behavior (injects the reloader into html files)
    if (htmlHandler) {
      const contents = await htmlHandler(file, req);
      if (contents) {
        return contents;
      }
    }

    const previewPath = (dir: string, file: string) => {
      return pathWithForwardSlashes(join(pdfJsBaseDir(), dir, file));
    };

    // tweak viewer.js to point to our pdf and force the sidebar off
    if (file === previewPath("web", "viewer.js")) {
      let viewerJs = Deno.readTextFileSync(file)
        .replace(
          kPdfJsDefaultFile,
          basename(pdfFile()),
        );

      if (isViewer) {
        viewerJs = viewerJs.replace(
          "sidebarView: sidebarView",
          "sidebarView: _ui_utils.SidebarView.NONE",
        );
      }

      return {
        contentType: contentType(file),
        body: new TextEncoder().encode(viewerJs),
      };
    } else if (file == previewPath("web", "viewer.css")) {
      const viewerCss = normalizeNewlines(Deno.readTextFileSync(file))
        .replace(
          kPdfJsViewerToolbarButtonSelector,
          kPdfJsViewerToolbarButtonSelector + "\n  z-index: 199;",
        )
        .replace(
          kPdfJsViewerSidebarTransitionDurationPattern,
          "$1 0",
        );
      return {
        contentType: contentType(file),
        body: new TextEncoder().encode(viewerCss),
      };

      // tweak pdf.worker.js to always return the same fingerprint
      // (preserve user viewer prefs across reloads)
    } else if (file === previewPath("build", "pdf.worker.js")) {
      const filePathHash = "quarto-preview-pdf-" +
        md5Hash(pdfFile());
      const workerJs = Deno.readTextFileSync(file).replace(
        /(key: "fingerprint",\s+get: function get\(\) {\s+)(var hash;)/,
        `$1return "${filePathHash}"; $2`,
      );
      return {
        contentType: contentType(file),
        body: new TextEncoder().encode(workerJs),
      };
    } // read requests for our pdf for the pdfFile
    else if (file === previewPath("web", basename(pdfFile()))) {
      return {
        contentType: contentType(file),
        body: Deno.readFileSync(pdfFile()),
      };
    }
  };
}
