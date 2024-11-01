/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { Command, Option } from "npm:clipanion";
import { applyCascade, isInInclusiveRange, isInteger, isNumber } from "npm:typanion";

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
import { exitWithCleanup } from "../../core/cleanup.ts";

const isPort = applyCascade(isNumber(), [
  isInteger(),
  isInInclusiveRange(1, 65535),
]);

export class ServeCommand extends Command {
  static name = 'serve';
  static paths = [[ServeCommand.name]];

  static usage = Command.Usage({
    description:
        "Serve a Shiny interactive document.\n\nBy default, the document will be rendered first and then served. " +
        "If you have previously rendered the document, pass --no-render to skip the rendering step.",
    examples: [
      [
        "Serve an interactive Shiny document",
        `$0 ${ServeCommand.name} dashboard.qmd`,
      ],
      [
        "Serve a document without rendering",
        `$0 ${ServeCommand.name} dashboard.qmd --no-render`,
      ]
    ]
  });

  input = Option.String();

  browser = Option.Boolean('--browser', true, {
    description: "Open a browser to preview the site."
  });

  host = Option.String('--host', {
    description: "Hostname to bind to (defaults to 127.0.0.1)",
  });

  render = Option.Boolean('--render', true, { description: "Render before serving." });

  port = Option.String('-p,--port', {
    description: "The TCP port that the application should listen on.",
    validator: isPort
  })

  async execute() {
    const { browser, input, render } = this;
    await initYamlIntelligenceResourcesFromFilesystem();
    const { host, port } = await resolveHostAndPort({ host: this.host, port: this.port });

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
      render,
      format,
      port,
      host,
      browser,
      projectDir: context?.dir,
      tempDir: Deno.makeTempDirSync(),
    });

    if (!result.success) {
      // error diagnostics already written to stderr
      exitWithCleanup(result.code);
    }
  }
}
