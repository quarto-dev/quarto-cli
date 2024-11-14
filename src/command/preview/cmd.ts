/*
 * cmd.ts
 *
 * Copyright (C) 2020-2024 Posit Software, PBC
 */

import { existsSync } from "../../deno_ral/fs.ts";
import { dirname, extname, join, relative } from "../../deno_ral/path.ts";

import { Command, Option } from "npm:clipanion";
import { applyCascade, isInInclusiveRange, isInteger, isNumber, isPositive } from "npm:typanion";

import { kLocalhost } from "../../core/port-consts.ts";
import { waitForPort } from "../../core/port.ts";
import { handleRenderResult, preview, previewFormat, setPreviewFormat, } from "./preview.ts";
import { kRenderDefault, kRenderNone, serveProject, } from "../../project/serve/serve.ts";

import { initState, setInitializer, } from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { kProjectWatchInputs, ProjectContext } from "../../project/types.ts";
import { projectContext } from "../../project/project-context.ts";
import { projectIsServeable, projectPreviewServe, } from "../../project/project-shared.ts";

import { isHtmlOutput } from "../../config/format.ts";
import { renderProject } from "../render/project.ts";
import { renderServices } from "../render/render-services.ts";
import { parseFormatString } from "../../core/pandoc/pandoc-formats.ts";
import { normalizePath } from "../../core/path.ts";
import { renderFormats } from "../render/render-contexts.ts";
import { Format } from "../../config/types.ts";
import { isServerShiny, isServerShinyPython } from "../../core/render.ts";
import { previewShiny } from "./preview-shiny.ts";
import { serve } from "../serve/serve.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";
import { notebookContext } from "../../render/notebook/notebook-context.ts";
import { singleFileProjectContext } from "../../project/types/single-file/single-file.ts";
import { exitWithCleanup } from "../../core/cleanup.ts";
import { RenderCommand } from "../render/cmd.ts";

const isPort = applyCascade(isNumber(), [
  isInteger(),
  isInInclusiveRange(1, 65535),
]);

export class PreviewCommand extends RenderCommand {
  static name = 'preview';
  static paths = [[PreviewCommand.name]];

  static usage = Command.Usage({
    description:
        "Render and preview a document or website project.\n\nAutomatically reloads the browser when " +
        "input files or document resources (e.g. CSS) change.\n\n" +
        "For website preview, the most recent execution results of computational documents are used to render\n" +
        "the site (this is to optimize startup time). If you want to perform a full render prior to\n" +
        'previewing pass the --render option with "all" or a comma-separated list of formats to render.\n\n' +
        "For document preview, input file changes will result in a re-render (pass --no-watch to prevent).\n\n" +
        "You can also include arbitrary command line arguments to be forwarded to quarto render.",
    examples: [
      [
        "Preview document",
        `$0 ${PreviewCommand.name} doc.qmd`,
      ],
      [
        "Preview document with render command line args",
        `$0 ${PreviewCommand.name} doc.qmd --toc`,
      ],
      [
        "Preview document (don't watch for input changes)",
        `$0 ${PreviewCommand.name} doc.qmd --no-watch-inputs`,
      ],
      [
        "Preview website with most recent execution results",
        `$0 ${PreviewCommand.name}`,
      ],
      [
        "Previewing website using a specific port",
        `$0 ${PreviewCommand.name} --port 4444`,
      ],
      [
        "Preview website (don't open a browser)",
        `$0 ${PreviewCommand.name} --no-browser`,
      ],
      [
        "Fully render all website/book formats then preview",
        `$0 ${PreviewCommand.name} --render all`,
      ],
      [
        "Fully render the html format then preview",
        `$0 ${PreviewCommand.name} --render html`,
      ]
    ]
  })

  browser = Option.Boolean('--browser,--browse', {
    description: "Open a browser to preview the site. (default true)"
  });

  browserPath = Option.String('--browser-path');

  host = Option.String('--host', {
    description: "Hostname to bind to (defaults to 127.0.0.1)",
  });

  navigate = Option.Boolean('--navigate', {
    description: "Navigate the browser automatically when outputs are updated. (default true)"
  });

  noRender = Option.Boolean('--no-render', {
    description: "Alias for --no-watch-inputs (used by older versions of rstudio)",
    hidden: true,
  });

  noWatch = Option.Boolean('--no-watch', {
    description: "Alias for --no-watch-inputs (used by older versions of quarto r package)",
    hidden: true,
  });

  presentation = Option.Boolean('--presentation');

  port = Option.String('--port', {
    description: "Suggested port to listen on (defaults to random value between 3000 and 8000).\n" +
        "If the port is not available then a random port between 3000 and 8000 will be selected.",
    validator: isPort
  })

  render = Option.String('--render', kRenderNone, {
    description: "Render to the specified format(s) before previewing",
    tolerateBoolean: true,
  });

  serve = Option.Boolean('--serve', {
    description: "Run a local preview web server\n" +
        "(default true; if false: just monitor and re-render input files)"
  });

  timeoutInSeconds = Option.String('--timeout', {
    description: "Time (in seconds) after which to exit if there are no active clients.",
    validator: applyCascade(isNumber(), [
      isInteger(),
      isPositive(),
    ])
  });

  watchInputs = Option.Boolean('--watch-inputs', {
    description: "Re-render input files when they change. (default true)"
  });

  async execute() {
    // --no-watch: alias for --no-watch-inputs (used by older versions of quarto r package)
    // --no-render: alias for --no-watch-inputs (used by older versions of rstudio)
    if (this.noWatch || this.noRender) {
      this.watchInputs = false;
    }

    // one-time initialization of yaml validation modules
    setInitializer(initYamlIntelligenceResourcesFromFilesystem);
    await initState();

    if (this.port) {
      if (!await waitForPort({ port: this.port, hostname: kLocalhost })) {
        throw new Error(`Requested port ${this.port} is already in use.`);
      }
    }

    // interpret first input as format if --render is used without parameter
    const render = typeof (this.render) === "boolean" ? (this.inputs.shift() || kRenderDefault) : this.render;

    let file = this.inputs[0] || Deno.cwd();
    if (!existsSync(file)) {
      throw new Error(`${file} not found`);
    }

    const flags = await this.parseRenderFlags();
    const args = this.formattedPandocArgs;

    // if this is a single-file preview within a 'serveable' project
    // without a specific render directive then render the file
    // and convert the render to a project one
    let touchPath: string | undefined;
    let projectTarget: string | ProjectContext = file;
    if (Deno.statSync(file).isFile) {
      // get project and preview format
      const nbContext = notebookContext();
      const project = (await projectContext(dirname(file), nbContext)) ||
          singleFileProjectContext(file, nbContext);
      const formats = await (async () => {
        const services = renderServices(nbContext);
        try {
          return await renderFormats(
              file!,
              services,
              undefined,
              project,
          );
        } finally {
          services.cleanup();
        }
      })();
      const format = await previewFormat(file, flags.to, formats, project);

      // see if this is server: shiny document and if it is then forward to previewShiny
      if (isHtmlOutput(parseFormatString(format).baseFormat)) {
        const renderFormat = formats[format] as Format | undefined;
        if (renderFormat && isServerShiny(renderFormat)) {
          const engine = await fileExecutionEngine(file, flags, project);
          setPreviewFormat(format, flags, args);
          if (isServerShinyPython(renderFormat, engine?.name)) {
            const result = await previewShiny({
              input: file,
              render: render !== kRenderNone,
              port: this.port,
              host: this.host,
              browser: this.browser !== false,
              projectDir: project?.dir,
              tempDir: Deno.makeTempDirSync(),
              format,
              pandocArgs: args,
              watchInputs: this.watchInputs!,
            });
            exitWithCleanup(result.code);
            throw new Error(); // unreachable
          } else {
            const result = await serve({
              input: file,
              render: render !== kRenderNone,
              port: this.port,
              host: this.host,
              format: format,
              browser: this.browser !== false,
              projectDir: project?.dir,
              tempDir: Deno.makeTempDirSync(),
            });
            exitWithCleanup(result.code);
            throw new Error(); // unreachable
          }
        }
      }

      if (project && projectIsServeable(project)) {
        // special case: plain markdown file w/ an external previewer that is NOT
        // in the project input list -- in this case allow things to proceed
        // without a render
        const filePath = normalizePath(file);
        if (!project.files.input.includes(filePath)) {
          if (extname(file) === ".md" && projectPreviewServe(project)) {
            setPreviewFormat(format, flags, args);
            touchPath = filePath;
            this.browserPath = "";
            file = project.dir;
            projectTarget = project;
          }
        } else {
          if (
              isHtmlOutput(parseFormatString(format).baseFormat, true) ||
              projectPreviewServe(project)
          ) {
            setPreviewFormat(format, flags, args);
            const services = renderServices(notebookContext());
            try {
              const renderResult = await renderProject(project, {
                services,
                progress: false,
                useFreezer: false,
                flags,
                pandocArgs: args,
                previewServer: true,
              }, [file]);
              if (renderResult.error) {
                throw renderResult.error;
              }
              handleRenderResult(file, renderResult);
              if (projectPreviewServe(project) && renderResult.baseDir) {
                touchPath = join(
                    renderResult.baseDir,
                    renderResult.files[0].file,
                );
              }
            } finally {
              services.cleanup();
            }
            // re-write various targets to redirect to project preview
            if (projectPreviewServe(project)) {
              this.browserPath = "";
            } else {
              this.browserPath = relative(project.dir, file);
            }
            file = project.dir;
            projectTarget = project;
          }
        }
      }
    }

    // see if we are serving a project or a file
    if (Deno.statSync(file).isDirectory) {
      // project preview
      const renderOptions = {
        services: renderServices(notebookContext()),
        flags,
      };
      await serveProject(projectTarget, renderOptions, args, {
        port: this.port,
        host: this.host,
        browser: (this.browser !== false) || undefined,
        [kProjectWatchInputs]: this.watchInputs,
        timeout: this.timeoutInSeconds,
        render,
        touchPath,
        browserPath: this.browserPath,
        navigate: this.navigate !== false,
      }, this.serve === false);
    } else {
      // single file preview
      if (
          render !== kRenderNone &&
          render !== kRenderDefault &&
          this.to === undefined
      ) {
        args.push(`--to=${render}`);
      }

      await preview(relative(Deno.cwd(), file), flags, args, {
        port: this.port,
        host: this.host,
        browser: (this.browser !== false) || undefined,
        [kProjectWatchInputs]: this.watchInputs,
        timeout: this.timeoutInSeconds,
        presentation: !!this.presentation,
      });
    }
  }
}
