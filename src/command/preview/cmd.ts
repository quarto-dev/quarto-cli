/*
 * cmd.ts
 *
 * Copyright (C) 2020-2022 Posit Software, PBC
 */

import { existsSync } from "fs/mod.ts";
import { dirname, extname, join, relative } from "path/mod.ts";

import * as colors from "fmt/colors.ts";

import { Command } from "cliffy/command/mod.ts";

import { kLocalhost } from "../../core/port-consts.ts";
import { waitForPort } from "../../core/port.ts";
import { fixupPandocArgs, parseRenderFlags } from "../render/flags.ts";
import {
  handleRenderResult,
  preview,
  previewFormat,
  setPreviewFormat,
} from "./preview.ts";
import {
  kRenderDefault,
  kRenderNone,
  serveProject,
} from "../../project/serve/serve.ts";

import {
  initState,
  setInitializer,
} from "../../core/lib/yaml-validation/state.ts";
import { initYamlIntelligenceResourcesFromFilesystem } from "../../core/schema/utils.ts";
import { kProjectWatchInputs, ProjectContext } from "../../project/types.ts";
import { projectContext } from "../../project/project-context.ts";
import {
  projectIsServeable,
  projectPreviewServe,
} from "../../project/project-shared.ts";

import { isHtmlOutput } from "../../config/format.ts";
import { renderProject } from "../render/project.ts";
import { renderServices } from "../render/render-services.ts";
import { parseFormatString } from "../../core/pandoc/pandoc-formats.ts";
import { normalizePath } from "../../core/path.ts";
import { kCliffyImplicitCwd } from "../../config/constants.ts";
import { warning } from "log/mod.ts";
import { renderFormats } from "../render/render-contexts.ts";
import { Format } from "../../config/types.ts";
import { isServerShiny, isServerShinyPython } from "../../core/render.ts";
import { previewShiny } from "./preview-shiny.ts";
import { serve } from "../serve/serve.ts";
import { fileExecutionEngine } from "../../execute/engine.ts";

export const previewCommand = new Command()
  .name("preview")
  .stopEarly()
  .option(
    "--port [port:number]",
    "Suggested port to listen on (defaults to random value between 3000 and 8000).\n" +
      "If the port is not available then a random port between 3000 and 8000 will be selected.",
  )
  .option(
    "--host [host:string]",
    "Hostname to bind to (defaults to 127.0.0.1)",
  )
  .option(
    "--render [format:string]",
    "Render to the specified format(s) before previewing",
    {
      default: kRenderNone,
    },
  )
  .option(
    "--no-serve",
    "Don't run a local preview web server (just monitor and re-render input files)",
  )
  .option(
    "--no-navigate",
    "Don't navigate the browser automatically when outputs are updated.",
  )
  .option(
    "--no-browser",
    "Don't open a browser to preview the site.",
  )
  .option(
    "--no-watch-inputs",
    "Do not re-render input files when they change.",
  )
  .option(
    "--timeout",
    "Time (in seconds) after which to exit if there are no active clients.",
  )
  .arguments("[file:string] [...args:string]")
  .description(
    "Render and preview a document or website project.\n\nAutomatically reloads the browser when " +
      "input files or document resources (e.g. CSS) change.\n\n" +
      "For website preview, the most recent execution results of computational documents are used to render\n" +
      "the site (this is to optimize startup time). If you want to perform a full render prior to\n" +
      'previewing pass the --render option with "all" or a comma-separated list of formats to render.\n\n' +
      "For document preview, input file changes will result in a re-render (pass --no-watch to prevent).\n\n" +
      "You can also include arbitrary command line arguments to be forwarded to " +
      colors.bold("quarto render") + ".",
  )
  .example(
    "Preview document",
    "quarto preview doc.qmd",
  )
  .example(
    "Preview document with render command line args",
    "quarto preview doc.qmd --toc",
  )
  .example(
    "Preview document (don't watch for input changes)",
    "quarto preview doc.qmd --no-watch-inputs",
  )
  .example(
    "Preview website with most recent execution results",
    "quarto preview",
  )
  .example(
    "Previewing website using a specific port",
    "quarto preview --port 4444",
  )
  .example(
    "Preview website (don't open a browser)",
    "quarto preview --no-browser",
  )
  .example(
    "Fully render all website/book formats then preview",
    "quarto preview --render all",
  )
  .example(
    "Fully render the html format then preview",
    "quarto preview --render html",
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any, file?: string, ...args: string[]) => {
    // one-time initialization of yaml validation modules
    setInitializer(initYamlIntelligenceResourcesFromFilesystem);
    await initState();

    // if input is missing but there exists an args parameter which is a .qmd or .ipynb file,
    // issue a warning.
    if (!file || file === kCliffyImplicitCwd) {
      file = Deno.cwd();
      const firstArg = args.find((arg) =>
        arg.endsWith(".qmd") || arg.endsWith(".ipynb")
      );
      if (firstArg) {
        warning(
          "`quarto preview` invoked with no input file specified (the parameter order matters).\nQuarto will preview the current directory by default.\n" +
            `Did you mean to run \`quarto preview ${firstArg} ${
              args.filter((arg) => arg !== firstArg).join(" ")
            }\`?\n` +
            "Use `quarto preview --help` for more information.",
        );
      }
    }

    file = file || Deno.cwd();
    if (!existsSync(file)) {
      throw new Error(`${file} not found`);
    }

    // show help if requested
    if (args.length > 0 && args[0] === "--help") {
      previewCommand.showHelp();
      return;
    }

    // pull out our command line args
    const portPos = args.indexOf("--port");
    if (portPos !== -1) {
      options.port = parseInt(args[portPos + 1]);
      args.splice(portPos, 2);
    }
    const hostPos = args.indexOf("--host");
    if (hostPos !== -1) {
      options.host = String(args[hostPos + 1]);
      args.splice(hostPos, 2);
    }
    const renderPos = args.indexOf("--render");
    if (renderPos !== -1) {
      options.render = String(args[renderPos + 1]);
      args.splice(renderPos, 2);
    }
    const presentationPos = args.indexOf("--presentation");
    if (presentationPos !== -1) {
      options.presentation = true;
      args.splice(presentationPos, 1);
    } else {
      options.presentation = false;
    }
    const browserPathPos = args.indexOf("--browser-path");
    if (browserPathPos !== -1) {
      options.browserPath = String(args[browserPathPos + 1]);
      args.splice(browserPathPos, 2);
    }
    const noServePos = args.indexOf("--no-serve");
    if (noServePos !== -1) {
      options.noServe = true;
      args.splice(noServePos, 1);
    }
    const noBrowsePos = args.indexOf("--no-browse");
    if (noBrowsePos !== -1) {
      options.browse = false;
      args.splice(noBrowsePos, 1);
    }
    const noBrowserPos = args.indexOf("--no-browser");
    if (noBrowserPos !== -1) {
      options.browser = false;
      args.splice(noBrowserPos, 1);
    }
    const navigatePos = args.indexOf("--navigate");
    if (navigatePos !== -1) {
      options.navigate = true;
      args.splice(navigatePos, 1);
    }
    const noNavigatePos = args.indexOf("--no-navigate");
    if (noNavigatePos !== -1) {
      options.navigate = false;
      args.splice(noNavigatePos, 1);
    }
    const watchInputsPos = args.indexOf("--watch-inputs");
    if (watchInputsPos !== -1) {
      options.watchInputs = true;
      args.splice(watchInputsPos, 1);
    }
    const noWatchInputsPos = args.indexOf("--no-watch-inputs");
    if (noWatchInputsPos !== -1) {
      options.watchInputs = false;
      args.splice(noWatchInputsPos, 1);
    }
    const timeoutPos = args.indexOf("--timeout");
    if (timeoutPos !== -1) {
      options.timeout = parseInt(args[timeoutPos + 1]);
      args.splice(timeoutPos, 2);
    }

    // alias for --no-watch-inputs (used by older versions of quarto r package)
    const noWatchPos = args.indexOf("--no-watch");
    if (noWatchPos !== -1) {
      options.watchInputs = false;
      args.splice(noWatchPos, 1);
    }
    // alias for --no-watch-inputs (used by older versions of rstudio)
    const noRenderPos = args.indexOf("--no-render");
    if (noRenderPos !== -1) {
      options.watchInputs = false;
      args.splice(noRenderPos, 1);
    }

    if (options.port) {
      // try to bind to requested port (error if its in use)
      const port = parseInt(options.port);
      if (await waitForPort({ port, hostname: kLocalhost })) {
        options.port = port;
      } else {
        throw new Error(`Requested port ${options.port} is already in use.`);
      }
    }

    // extract pandoc flag values we know/care about, then fixup args as
    // necessary (remove our flags that pandoc doesn't know about)
    const flags = await parseRenderFlags(args);
    args = fixupPandocArgs(args, flags);

    // if this is a single-file preview within a 'serveable' project
    // without a specific render directive then render the file
    // and convert the render to a project one
    let touchPath: string | undefined;
    let projectTarget: string | ProjectContext = file;
    if (Deno.statSync(file).isFile) {
      // get project and preview format
      const project = await projectContext(dirname(file));
      const formats = await renderFormats(file, undefined, project);
      const format = await previewFormat(file, flags.to, formats, project);

      // see if this is server: shiny document and if it is then forward to previewShiny
      if (isHtmlOutput(parseFormatString(format).baseFormat)) {
        const renderFormat = formats[format] as Format | undefined;
        if (renderFormat && isServerShiny(renderFormat)) {
          const engine = fileExecutionEngine(file, flags);
          setPreviewFormat(format, flags, args);
          if (isServerShinyPython(renderFormat, engine?.name)) {
            const result = await previewShiny({
              input: file,
              render: !!options.render,
              port: typeof (options.port) === "string"
                ? parseInt(options.port)
                : options.port,
              host: options.host,
              browser: options.browser,
              projectDir: project?.dir,
              tempDir: Deno.makeTempDirSync(),
              format,
              pandocArgs: args,
              watchInputs: options.watchInputs!,
            });
            Deno.exit(result.code);
          } else {
            const result = await serve({
              input: file,
              render: !!options.render,
              port: typeof (options.port) === "string"
                ? parseInt(options.port)
                : options.port,
              host: options.host,
              format: format,
              browser: options.browser,
              projectDir: project?.dir,
              tempDir: Deno.makeTempDirSync(),
            });
            Deno.exit(result.code);
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
            options.browserPath = "";
            file = project.dir;
            projectTarget = project;
          }
        } else {
          if (
            isHtmlOutput(parseFormatString(format).baseFormat, true) ||
            projectPreviewServe(project)
          ) {
            setPreviewFormat(format, flags, args);
            const services = renderServices();
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
              handleRenderResult(file, renderResult, project);
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
              options.browserPath = "";
            } else {
              options.browserPath = relative(project.dir, file);
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
      await serveProject(projectTarget, flags, args, {
        port: options.port,
        host: options.host,
        browser: (options.browser === false || options.browse === false)
          ? false
          : undefined,
        [kProjectWatchInputs]: options.watchInputs,
        timeout: options.timeout,
        render: options.render,
        touchPath,
        browserPath: options.browserPath,
        navigate: options.navigate,
      }, options.noServe === true);
    } else {
      // single file preview
      if (
        options.render !== kRenderNone &&
        options.render !== kRenderDefault &&
        args.indexOf("--to") === -1
      ) {
        args.push("--to", options.render);
      }

      await preview(relative(Deno.cwd(), file), flags, args, {
        port: options.port,
        host: options.host,
        browser: (options.browser === false || options.browse === false)
          ? false
          : undefined,
        [kProjectWatchInputs]: options.watchInputs,
        timeout: options.timeout,
        presentation: options.presentation,
      });
    }
  });
