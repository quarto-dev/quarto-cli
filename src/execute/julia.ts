import { error, info } from "log/mod.ts";
import { join } from "path/mod.ts";
import { MappedString, mappedStringFromFile } from "../core/mapped-text.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { execProcess } from "../core/process.ts";
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
import {
  jupyterAssets,
  jupyterFromJSON,
  jupyterToMarkdown,
} from "../core/jupyter/jupyter.ts";
import {
  kExecuteDaemon,
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
import { md5Hash } from "../core/hash.ts";
import { isInteractiveSession } from "../core/platform.ts";
import { runningInCI } from "../core/ci-info.ts";
import { ProcessResult } from "../core/process-types.ts";
import { sleep } from "../core/async.ts";
import { JupyterNotebook } from "../core/jupyter/types.ts";
import { existsSync } from "fs/mod.ts";
import { readTextFileSync } from "../core/qualified-path.ts";
import { number } from "https://deno.land/x/cliffy@v0.25.4/flags/types/number.ts";

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
    console.log("running execute method of the julia engine");
    options.target.source;

    // use daemon by default if we are in an interactive session (terminal
    // or rstudio) and not running in a CI system.
    let executeDaemon = options.format.execute[kExecuteDaemon];
    if (executeDaemon === null || executeDaemon === undefined) {
      // if (await disableDaemonForNotebook(options.target)) {
      //   executeDaemon = false;
      // } else {
      executeDaemon = isInteractiveSession() && !runningInCI();
      // }
    }

    // julia back end requires full path to input (to ensure that
    // keepalive kernels are never re-used across multiple inputs
    // that happen to share a hash)
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

    // if (executeDaemon === false || executeDaemon === 0) {
    const nb = await executeJulia(juliaExecOptions);
    // } else {
    //   // await executeJuliaKeepalive(juliaExecOptions);
    // }

    // NOTE: the following is all mostly copied from the jupyter kernel file

    // const nb = jupyterFromJSON(notebookJSON);

    // TODO: jupyterFromFile sets python as the default kernelspec for the files we get from QuartoNotebookRunner,
    // maybe the correct "kernel" needs to be set there instead (there isn't really a kernel needed as we don't execute via Jupyter
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

async function startJuliaServer(options: JuliaExecuteOptions) {
  const transportFile = juliaTransportFile();
  console.log("Transport file: ", transportFile);
  if (!existsSync(transportFile)) {
    console.log("Transport file doesn't exist, starting server");
    // when quarto's execProc function is used here, there is a strange bug.
    // The first time render is called on a file, the julia server is started correctly.
    // The second time it is called, however, the socket server hangs if during the first
    // run anything was written to stderr. This goes away when redirecting stderr to
    // a file on the julia side, but also when using Deno.Command which is recommended
    // as a replacement for the old Deno.run anyway.
    const command = new Deno.Command(options.julia_cmd[0], {
      args: [
        ...(options.julia_cmd.slice(1)),
        "--project=@quarto",
        resourcePath("julia/quartonotebookrunner.jl"),
        transportFile,
      ],
    });
    // this process is supposed to outlive the quarto process, because
    // in it, the references to the cached julia worker processes live
    command.spawn();
  }
  return Promise.resolve();
}

interface JuliaTransportFile {
  port: number;
  pid: number;
}

async function pollTransportFile(): Promise<JuliaTransportFile> {
  const transportFile = juliaTransportFile();

  for (let i = 0; i < 20; i++) {
    await sleep(i * 100);
    if (existsSync(transportFile)) {
      const content = Deno.readTextFileSync(transportFile);
      return JSON.parse(content) as JuliaTransportFile;
    }
  }
  return Promise.reject();
}

async function establishServerConnection(port: number): Promise<Deno.TcpConn> {
  let conn = null;
  for (let i = 0; i < 20; i++) {
    await sleep(i * 100);
    conn = await Deno.connect({
      port: port,
    }).catch((reason) => {
      console.log(`Connecting to julia server failed on try ${i}`, reason);
      return null;
    });
    if (conn !== null) {
      console.log("Connection successfully established");
      return conn;
    }
  }

  return Promise.reject();
}

async function executeJulia(
  options: JuliaExecuteOptions,
): Promise<JupyterNotebook> {
  await startJuliaServer(options);
  const transportOptions = await pollTransportFile();
  console.log(transportOptions);
  const conn = await establishServerConnection(transportOptions.port);

  if (options.oneShot) {
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
  let messageBytes = new TextEncoder().encode(
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

  console.log("write command ", command, " to socket server");
  const bytesWritten = await conn.write(messageBytes);
  if (bytesWritten !== messageBytes.length) {
    throw new Error("Internal Error");
  }

  let response = "";
  while (true) {
    const buffer = new Uint8Array(512);

    console.log("trying to read bytes into buffer");
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
  // one command should be sent, ended by a newline, currently just throwing away anything else because we don't
  // expect multiple commmands
  const json = response.split("\n")[0];
  const data = JSON.parse(json);

  console.log("Received data from server");
  // console.log(data);

  return data;
}

function juliaTransportFile() {
  let transportsDir: string;

  try {
    transportsDir = quartoRuntimeDir("julia");
  } catch (e) {
    console.error("Could create runtime directory for the julia pidfile.");
    console.error(
      "This is possibly a permission issue in the environment Quarto is running in.",
    );
    console.error(
      "Please consult the following documentation for more information:",
    );
    console.error(
      "https://github.com/quarto-dev/quarto-cli/issues/4594#issuecomment-1619177667",
    );
    throw e;
  }
  return join(transportsDir, "julia_transport.txt");
}
