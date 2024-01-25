import { error, info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { MappedString, mappedStringFromFile } from "../core/mapped-text.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { ProjectContext } from "../project/types.ts";
import {
  DependenciesOptions,
  ExecuteOptions,
  ExecuteResult,
  ExecutionEngine,
  ExecutionTarget,
  kJuliaEngine,
  PandocIncludes,
  PostProcessOptions,
} from "./types.ts";
import { jupyterAssets, jupyterToMarkdown } from "../core/jupyter/jupyter.ts";
import {
  kExecuteDaemon,
  kExecuteDaemonRestart,
  kExecuteDebug,
  kFigDpi,
  kFigFormat,
  kFigPos,
  kIpynbProduceSourceNotebook,
  kKeepHidden,
} from "../config/constants.ts";
import {
  isHtmlCompatible,
  isIpynbOutput,
  isLatexOutput,
  isMarkdownOutput,
  isPresentationOutput,
} from "../config/format.ts";
import { resourcePath } from "../core/resources.ts";
import { quartoRuntimeDir } from "../core/appdirs.ts";
import { normalizePath } from "../core/path.ts";
import { isInteractiveSession } from "../core/platform.ts";
import { runningInCI } from "../core/ci-info.ts";
import { sleep } from "../core/async.ts";
import { JupyterNotebook } from "../core/jupyter/types.ts";
import { existsSync } from "fs/mod.ts";

export interface JuliaExecuteOptions extends ExecuteOptions {
  julia_cmd: string[];
  oneShot: boolean; // if true, the file's worker process is closed before and after running
  supervisor_pid?: number;
}

export const juliaEngine: ExecutionEngine = {
  name: kJuliaEngine,

  defaultExt: ".qmd",

  defaultYaml: () => [],

  defaultContent: () => [
    "```{julia}",
    "1 + 1",
    "```",
  ],

  validExtensions: () => [],

  claimsFile: (file: string, ext: string) => false,

  claimsLanguage: (language: string) => {
    return language.toLowerCase() === "julia";
  },

  partitionedMarkdown: async (file: string) => {
    return partitionMarkdown(Deno.readTextFileSync(file));
  },

  // TODO: ask dragonstyle what to do here
  executeTargetSkipped: () => false,

  // TODO: just return dependencies from execute and this can do nothing
  dependencies: (_options: DependenciesOptions) => {
    const includes: PandocIncludes = {};
    return Promise.resolve({
      includes,
    });
  },

  // TODO: this can also probably do nothing
  postprocess: (_options: PostProcessOptions) => {
    return Promise.resolve();
  },

  canFreeze: true,

  generatesFigures: true,

  ignoreDirs: () => {
    return [];
  },

  canKeepSource: (_target: ExecutionTarget) => {
    return true;
  },

  execute: async (options: ExecuteOptions): Promise<ExecuteResult> => {
    options.target.source;

    // use daemon by default if we are in an interactive session (terminal
    // or rstudio) and not running in a CI system.
    let executeDaemon = options.format.execute[kExecuteDaemon];
    if (executeDaemon === null || executeDaemon === undefined) {
      executeDaemon = isInteractiveSession() && !runningInCI();
    }

    const execOptions = {
      ...options,
      target: {
        ...options.target,
        input: normalizePath(options.target.input),
      },
    };

    const juliaExecOptions: JuliaExecuteOptions = {
      julia_cmd: ["julia"],
      oneShot: !executeDaemon,
      supervisor_pid: options.previewServer ? Deno.pid : undefined,
      ...execOptions,
    };

    // TODO: executeDaemon can take a number for timeout of kernels, but
    // QuartoNotebookRunner currently doesn't support that
    const nb = await executeJulia(juliaExecOptions);

    // NOTE: the following is all mostly copied from the jupyter kernel file

    // there isn't really a "kernel" as we don't execute via Jupyter
    // but this seems to be needed later to assign the correct language markers to code cells etc.)
    nb.metadata.kernelspec = {
      display_name: "Julia",
      name: "julia",
      language: "julia",
    };

    const assets = jupyterAssets(
      options.target.input,
      options.format.pandoc.to,
    );

    // NOTE: for perforance reasons the 'nb' is mutated in place
    // by jupyterToMarkdown (we don't want to make a copy of a
    // potentially very large notebook) so should not be relied
    // on subseuqent to this call

    const result = await jupyterToMarkdown(
      nb,
      {
        executeOptions: options,
        language: nb.metadata.kernelspec.language.toLowerCase(),
        assets,
        execute: options.format.execute,
        keepHidden: options.format.render[kKeepHidden],
        toHtml: isHtmlCompatible(options.format),
        toLatex: isLatexOutput(options.format.pandoc),
        toMarkdown: isMarkdownOutput(options.format),
        toIpynb: isIpynbOutput(options.format.pandoc),
        toPresentation: isPresentationOutput(options.format.pandoc),
        figFormat: options.format.execute[kFigFormat],
        figDpi: options.format.execute[kFigDpi],
        figPos: options.format.render[kFigPos],
        // preserveCellMetadata,
        preserveCodeCellYaml:
          options.format.render[kIpynbProduceSourceNotebook] === true,
      },
    );

    // Create markdown from the result
    const outputs = result.cellOutputs.map((output) => output.markdown);
    if (result.notebookOutputs) {
      if (result.notebookOutputs.prefix) {
        outputs.unshift(result.notebookOutputs.prefix);
      }
      if (result.notebookOutputs.suffix) {
        outputs.push(result.notebookOutputs.suffix);
      }
    }
    const markdown = outputs.join("");

    // return results
    return {
      engine: kJuliaEngine,
      markdown: markdown,
      supporting: [join(assets.base_dir, assets.supporting_dir)],
      filters: [],
      pandoc: result.pandoc,
      // includes,
      // engineDependencies,
      preserve: result.htmlPreserve,
      postProcess: result.htmlPreserve &&
        (Object.keys(result.htmlPreserve).length > 0),
    };
  },

  target: async (
    file: string,
    _quiet?: boolean,
    markdown?: MappedString,
    _project?: ProjectContext,
  ): Promise<ExecutionTarget | undefined> => {
    if (markdown === undefined) {
      markdown = mappedStringFromFile(file);
    }
    const target: ExecutionTarget = {
      source: file,
      input: file,
      markdown,
      metadata: readYamlFromMarkdown(markdown.value),
    };
    return Promise.resolve(target);
  },
};

async function startOrReuseJuliaServer(
  options: JuliaExecuteOptions,
): Promise<{ reused: boolean }> {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    trace(
      options,
      `Transport file ${transportFile} doesn't exist, starting server.`,
    );

    info(
      "Initializing julia control server. This might take a while...",
    );
    await ensureQuartoNotebookRunnerEnvironment(options);

    // when quarto's execProc function is used here, there is a strange bug.
    // The first time render is called on a file, the julia server is started correctly.
    // The second time it is called, however, the socket server hangs if during the first
    // run anything was written to stderr. This goes away when redirecting stderr to
    // a file on the julia side, but also when using Deno.Command which is recommended
    // as a replacement for the old Deno.run anyway.
    const command = new Deno.Command(options.julia_cmd[0], {
      args: [
        ...(options.julia_cmd.slice(1)),
        `--project=${juliaRuntimeDir()}`,
        resourcePath("julia/quartonotebookrunner.jl"),
        transportFile,
      ],
    });
    // this process is supposed to outlive the quarto process, because
    // in it, the references to the cached julia worker processes live
    command.spawn();
  } else {
    trace(
      options,
      `Transport file ${transportFile} exists, reusing server.`,
    );
    return { reused: true };
  }
  return { reused: false };
}

async function ensureQuartoNotebookRunnerEnvironment(
  options: JuliaExecuteOptions,
) {
  const projectTomlTemplate = juliaResourcePath("Project.toml");
  const projectToml = join(juliaRuntimeDir(), "Project.toml");
  Deno.copyFileSync(projectTomlTemplate, projectToml);
  const command = new Deno.Command(options.julia_cmd[0], {
    args: [
      ...(options.julia_cmd.slice(1)),
      `--project=${juliaRuntimeDir()}`,
      juliaResourcePath("ensure_environment.jl"),
    ],
  });
  const { success, stderr } = await command.output();
  if (!success) {
    error(
      `Ensuring an updated julia server environment failed: ${
        stderr && new TextDecoder().decode(stderr)
      }`,
    );
    return Promise.reject();
  }
  trace(options, "The julia server environment is correctly instantiated.");
  return Promise.resolve();
}

function juliaResourcePath(...parts: string[]) {
  return join(resourcePath("julia"), ...parts);
}

interface JuliaTransportFile {
  port: number;
  pid: number;
}

async function pollTransportFile(): Promise<JuliaTransportFile> {
  const transportFile = juliaTransportFile();

  for (let i = 0; i < 20; i++) {
    if (existsSync(transportFile)) {
      const content = Deno.readTextFileSync(transportFile);
      return JSON.parse(content) as JuliaTransportFile;
    }
    await sleep(i * 100);
  }
  return Promise.reject();
}

async function establishServerConnection(
  port: number,
): Promise<Deno.TcpConn> {
  // Because the transport file is written after the server goes live,
  // the connection should succeed immediately.
  return await Deno.connect({
    port: port,
  });
}

async function getJuliaServerConnection(
  options: JuliaExecuteOptions,
): Promise<Deno.TcpConn> {
  const { reused } = await startOrReuseJuliaServer(options);
  const transportOptions = await pollTransportFile();
  trace(
    options,
    `Connecting to server at port ${transportOptions.port}, pid ${transportOptions.pid}`,
  );
  try {
    return await establishServerConnection(transportOptions.port);
  } catch {
    if (reused) {
      trace(
        options,
        "Connecting to server failed, a transport file was reused so it might be stale. Delete transport file and retry.",
      );
      Deno.removeSync(juliaTransportFile());
      return await getJuliaServerConnection(options);
    } else {
      error(
        "Connecting to server failed. A transport file was successfully created by the server process, so something in the server process might be broken.",
      );
      return Promise.reject();
    }
  }
}

async function executeJulia(
  options: JuliaExecuteOptions,
): Promise<JupyterNotebook> {
  const conn = await getJuliaServerConnection(options);
  if (options.oneShot || options.format.execute[kExecuteDaemonRestart]) {
    await writeJuliaCommand(conn, "close", "TODOsomesecret", options);
  }
  const response = await writeJuliaCommand(
    conn,
    "run",
    "TODOsomesecret",
    options,
  );
  if (options.oneShot) {
    await writeJuliaCommand(conn, "close", "TODOsomesecret", options);
  }

  return response.notebook as JupyterNotebook;
}

async function writeJuliaCommand(
  conn: Deno.Conn,
  command: "run" | "close" | "stop",
  secret: string,
  options: JuliaExecuteOptions,
) {
  // TODO: no secret used, yet
  const messageBytes = new TextEncoder().encode(
    JSON.stringify({
      type: command,
      content: options.target.input,
    }) + "\n",
  );

  // // don't send the message if it's big.
  // // Instead, write it to a file and send the file path
  // // This is disappointing, but something is deeply wrong with Deno.Conn:
  // // https://github.com/quarto-dev/quarto-cli/issues/7737#issuecomment-1830665357
  // if (messageBytes.length > 1024) {
  //   const tempFile = Deno.makeTempFileSync();
  //   Deno.writeFileSync(tempFile, messageBytes);
  //   const msg = kernelCommand("file", secret, { file: tempFile }) + "\n";
  //   messageBytes = new TextEncoder().encode(msg);
  // }

  trace(options, `write command "${command}" to socket server`);
  const bytesWritten = await conn.write(messageBytes);
  if (bytesWritten !== messageBytes.length) {
    throw new Error("Internal Error");
  }

  let response = "";
  while (true) {
    const buffer = new Uint8Array(512);
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) {
      break;
    }

    if (bytesRead > 0) {
      const payload = new TextDecoder().decode(
        buffer.slice(0, bytesRead),
      );
      response += payload;
      if (payload.includes("\n")) {
        break;
      }
    }
  }
  trace(options, "received server response");
  // one command should be sent, ended by a newline, currently just throwing away anything else because we don't
  // expect multiple commmands
  const json = response.split("\n")[0];
  const data = JSON.parse(json);

  return data;
}

function juliaRuntimeDir(): string {
  try {
    return quartoRuntimeDir("julia");
  } catch (e) {
    error("Could not create julia runtime directory.");
    error(
      "This is possibly a permission issue in the environment Quarto is running in.",
    );
    error(
      "Please consult the following documentation for more information:",
    );
    error(
      "https://github.com/quarto-dev/quarto-cli/issues/4594#issuecomment-1619177667",
    );
    throw e;
  }
}

function juliaTransportFile() {
  return join(juliaRuntimeDir(), "julia_transport.txt");
}

function trace(options: ExecuteOptions, msg: string) {
  if (options.format.execute[kExecuteDebug]) {
    info("- " + msg, { bold: true });
  }
}
