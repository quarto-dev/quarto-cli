/*
 * preview-shiny.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { info } from "../../deno_ral/log.ts";

import { dirname, extname, isAbsolute, join } from "../../deno_ral/path.ts";

import { RunOptions } from "../../execute/types.ts";
import { ProjectContext } from "../../project/types.ts";
import { serve } from "../serve/serve.ts";
import {
  previewUnableToRenderResponse,
  renderToken,
} from "../render/render-shared.ts";
import { HttpFileRequestOptions } from "../../core/http-types.ts";
import {
  createChangeHandler,
  isPreviewRenderRequest,
  isPreviewTerminateRequest,
  PreviewRenderRequest,
  previewRenderRequest,
  previewRenderRequestIsCompatible,
  renderForPreview,
  RenderForPreviewResult,
} from "./preview.ts";
import { exitWithCleanup, onCleanup } from "../../core/cleanup.ts";
import {
  httpContentResponse,
  httpFileRequestHandler,
} from "../../core/http.ts";
import { findOpenPort } from "../../core/port.ts";
import { handleHttpRequests } from "../../core/http-server.ts";
import { kLocalhost } from "../../core/port-consts.ts";
import { normalizePath } from "../../core/path.ts";
import { previewMonitorResources } from "../../core/quarto.ts";
import { renderServices } from "../render/render-services.ts";
import { RenderFlags } from "../render/types.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { isIpynbOutput } from "../../config/format.ts";

export interface PreviewShinyOptions extends RunOptions {
  pandocArgs: string[];
  watchInputs: boolean;
  project?: ProjectContext;
}

export async function previewShiny(options: PreviewShinyOptions) {
  // monitor dev resources
  previewMonitorResources();

  // render for preview
  let rendering = false;
  const renderingFile = isAbsolute(options.input)
    ? options.input
    : join(Deno.cwd(), options.input);
  const render = async (to?: string) => {
    to = to || options.format;
    const renderFlags: RenderFlags = { to, execute: true };
    const services = renderServices(notebookContext());
    try {
      rendering = true;
      const result = await renderForPreview(
        options.input,
        services,
        renderFlags,
        options.pandocArgs,
        options.project,
      );
      return result;
    } finally {
      services.cleanup();
      rendering = false;
    }
  };
  const result = await render();

  // watch for changes and re-render / re-load as necessary
  const changeHandler = createChangeHandler(
    // result to kick off change handling
    result,
    // render for reload, but provide a reload filter that prevents
    // rendering for files that shiny will auto-reload on and on
    // the .html file that we generate
    {
      reloadClients: async () => {
        await render();
      },
    },
    // delegate to render
    render,
    // watch .qmd if requested
    options.watchInputs,
    // filter files that shiny will reload on
    (file: string) => {
      const ext = extname(file);
      return ![".py", ".html", ".htm"].includes(ext);
    },
    (files: string[]) => {
      if (
        files.length === 1 && files[0] === renderingFile &&
        extname(files[0]) === ".ipynb"
      ) {
        return rendering;
      }
      return false;
    },
  );

  // if a render token was provided then run a control channel to fulfill render requests
  if (renderToken()) {
    runPreviewControlService(options, changeHandler.render);
  }

  // serve w/ reload
  return await serve({ ...options, render: false, reload: true });
}

function runPreviewControlService(
  options: PreviewShinyOptions,
  renderHandler: (to?: string) => Promise<RenderForPreviewResult | undefined>,
) {
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
          renderHandler();
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
