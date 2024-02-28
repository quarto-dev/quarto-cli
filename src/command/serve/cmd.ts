/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { Command } from "cliffy/command/mod.ts";

import * as colors from "fmt/colors.ts";
import { error } from "../../deno_ral/log.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { projectContext } from "../../project/project-context.ts";

import { serve } from "./serve.ts";
import { resolveHostAndPort } from "../../core/previewurl.ts";
import { renderFormats } from "../render/render-contexts.ts";
import { previewFormat } from "../preview/preview.ts";
import { withRenderServices } from "../render/render-services.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { RenderServices } from "../render/types.ts";
import { singleFileProjectContext } from "../../project/types/single-file/single-file.ts";

export const serveCommand = new Command()
  .name("serve")
  .arguments("[input:string]")
  .option(
    "--no-render",
    "Do not render the document before serving.",
  )
  .option(
    "-p, --port [port:number]",
    "The TCP port that the application should listen on.",
  )
  .option(
    "--host [host:string]",
    "Hostname to bind to (defaults to 127.0.0.1)",
  )
  .option(
    "--browser",
    "Open a browser to preview the site.",
  )
  .description(
    "Serve a Shiny interactive document.\n\nBy default, the document will be rendered first and then served. " +
      "If you have previously rendered the document, pass --no-render to skip the rendering step.",
  )
  .example(
    "Serve an interactive Shiny document",
    "quarto serve dashboard.qmd",
  )
  .example(
    "Serve a document without rendering",
    "quarto serve dashboard.qmd --no-render",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, input?: string) => {
    await initYamlIntelligenceResourcesFromFilesystem();
    if (!input) {
      error(
        "No input passed to serve.\n" +
          "If you are attempting to preview a website or book use the " +
          colors.bold("quarto preview") + " command instead.",
      );
      Deno.exit(1);
    }

    const { host, port } = await resolveHostAndPort(options);

    const nbContext = notebookContext();
    const context = (await projectContext(input, nbContext)) ||
      singleFileProjectContext(input, nbContext);
    const formats = await withRenderServices(
      nbContext,
      (services: RenderServices) =>
        renderFormats(input, services, undefined, context),
    );
    const format = await previewFormat(input, undefined, formats, context);

    const result = await serve({
      input,
      render: options.render,
      format,
      port,
      host,
      browser: options.browser,
      projectDir: context?.dir,
      tempDir: Deno.makeTempDirSync(),
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      Deno.exit(result.code);
    }
  });
