/*
 * preview-shiny.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "log/mod.ts";

import { basename, dirname } from "path/mod.ts";

import { RunOptions } from "../../execute/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { renderForServe, serve } from "../serve/serve.ts";
import {
  previewUnableToRenderResponse,
  printWatchingForChangesMessage,
  renderToken,
} from "../render/render-shared.ts";
import { HttpFileRequestOptions } from "../../core/http-types.ts";
import {
  isPreviewRenderRequest,
  isPreviewTerminateRequest,
  PreviewRenderRequest,
  previewRenderRequest,
  previewRenderRequestIsCompatible,
} from "./preview.ts";
import { exitWithCleanup, onCleanup } from "../../core/cleanup.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
} from "../../core/http.ts";
import { findOpenPort } from "../../core/port.ts";
import { handleHttpRequests } from "../../core/http-server.ts";
import { kLocalhost } from "../../core/port-consts.ts";
import { logError } from "../../core/log.ts";
import { renderResultFinalOutput } from "../render/render.ts";
import { normalizePath } from "../../core/path.ts";

export interface PreviewShinyOptions extends RunOptions {
  project?: ProjectContext;
}

export async function previewShiny(options: PreviewShinyOptions) {
  // if a render token was provided then run a control channel
  // where render requests can be fulfilled
  if (renderToken()) {
    // helper to check whether a render request is compatible
    // with the original render
    const isCompatibleRequest = async (prevReq: PreviewRenderRequest) => {
      return normalizePath(options.input) === normalizePath(prevReq.path) &&
        await previewRenderRequestIsCompatible(
          prevReq,
          options.format,
          options.project,
        );
    };

    const baseDir = dirname(options.input);

    const handlerOptions: HttpFileRequestOptions = {
      baseDir,

      onRequest: async (req: Request) => {
        if (isPreviewTerminateRequest(req)) {
          exitWithCleanup(0);
        } else if (isPreviewRenderRequest(req)) {
          const prevReq = previewRenderRequest(req, true, baseDir);
          if (prevReq && await isCompatibleRequest(prevReq)) {
            renderForServe(options.input, prevReq.format)
              .then((result) => {
                // handle error
                if (result.error?.message) {
                  logError(result.error);
                } else {
                  // print output created
                  const finalOutput = renderResultFinalOutput(
                    result,
                    dirname(prevReq.path),
                  );
                  if (!finalOutput) {
                    throw new Error(
                      "No output created by quarto render " +
                        basename(prevReq.path),
                    );
                  }
                  info("Output created: " + finalOutput + "\n");
                  printWatchingForChangesMessage();
                }
              });

            // return immediately with rendered status
            return httpContentResponse("rendered");
          } else {
            return previewUnableToRenderResponse();
          }
        } else {
          return undefined;
        }
      },
    };

    const handler = httpFileRequestHandler(handlerOptions);

    const port = findOpenPort();

    const controlListener = Deno.listen({ port, hostname: kLocalhost });
    onCleanup(() => controlListener.close());

    handleHttpRequests(controlListener, handler).then(() => {
      // terminanted
    }).catch((_error) => {
      // ignore errors
    });
    info(`Preview service running (${port})`);
  }

  // serve w/ reload
  return await serve({ ...options, reload: true });
}
