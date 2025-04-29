import { error, info } from "../deno_ral/log.ts";
import { join } from "../deno_ral/path.ts";
import { MappedString, mappedStringFromFile } from "../core/mapped-text.ts";
import { partitionMarkdown } from "../core/pandoc/pandoc-partition.ts";
import { readYamlFromMarkdown } from "../core/yaml.ts";
import { asMappedString } from "../core/lib/mapped-text.ts";
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
import { normalizePath, pathWithForwardSlashes } from "../core/path.ts";
import { isInteractiveSession } from "../core/platform.ts";
import { runningInCI } from "../core/ci-info.ts";
import { sleep } from "../core/async.ts";
import { JupyterNotebook } from "../core/jupyter/types.ts";
import { existsSync, safeRemoveSync } from "../deno_ral/fs.ts";
import { encodeBase64 } from "encoding/base64";
import {
  executeResultEngineDependencies,
  executeResultIncludes,
} from "./jupyter/jupyter.ts";
import { isWindows } from "../deno_ral/platform.ts";
import { Command } from "cliffy/command/mod.ts";
import {
  isJupyterPercentScript,
  markdownFromJupyterPercentScript,
} from "./jupyter/percent.ts";

export interface JuliaExecuteOptions extends ExecuteOptions {
  oneShot: boolean; // if true, the file's worker process is closed before and after running
}

function isJuliaPercentScript(file: string) {
  return isJupyterPercentScript(file, [".jl"]);
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

  claimsFile: (file: string, _ext: string) => {
    return isJuliaPercentScript(file);
  },

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

  markdownForFile(file: string): Promise<MappedString> {
    if (isJuliaPercentScript(file)) {
      return Promise.resolve(
        asMappedString(markdownFromJupyterPercentScript(file)),
      );
    } else {
      return Promise.resolve(mappedStringFromFile(file));
    }
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
      oneShot: !executeDaemon,
      ...execOptions,
    };

    // TODO: executeDaemon can take a number for timeout of kernels, but
    // QuartoNotebookRunner currently doesn't support that
    const nb = await executeJulia(juliaExecOptions);

    if (!nb) {
      error("Execution of notebook returned undefined");
      return Promise.reject();
    }

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

    // return dependencies as either includes or raw dependencies
    let includes: PandocIncludes | undefined;
    let engineDependencies: Record<string, Array<unknown>> | undefined;
    if (options.dependencies) {
      includes = executeResultIncludes(options.tempDir, result.dependencies);
    } else {
      const dependencies = executeResultEngineDependencies(result.dependencies);
      if (dependencies) {
        engineDependencies = {
          [kJuliaEngine]: dependencies,
        };
      }
    }

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
      includes,
      engineDependencies,
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

  populateCommand: populateJuliaEngineCommand,
};

function juliaCmd() {
  return Deno.env.get("QUARTO_JULIA") ?? "julia";
}

function powershell_argument_list_to_string(...args: string[]): string {
  // formats as '"arg 1" "arg 2" "arg 3"'
  const inner = args.map((arg) => `"${arg}"`).join(" ");
  return `'${inner}'`;
}

async function startOrReuseJuliaServer(
  options: JuliaExecuteOptions,
): Promise<{ reused: boolean }> {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    trace(
      options,
      `Transport file ${transportFile} doesn't exist`,
    );
    info("Starting julia control server process. This might take a while...");

    let juliaProject = Deno.env.get("QUARTO_JULIA_PROJECT");

    if (juliaProject === undefined) {
      await ensureQuartoNotebookRunnerEnvironment(options);
      juliaProject = juliaRuntimeDir();
    } else {
      juliaProject = pathWithForwardSlashes(juliaProject);
      trace(
        options,
        `Custom julia project set via QUARTO_JULIA_PROJECT="${juliaProject}". Checking if QuartoNotebookRunner can be loaded.`,
      );
      const qnrTestCommand = new Deno.Command(juliaCmd(), {
        args: [
          "--startup-file=no",
          `--project=${juliaProject}`,
          "-e",
          "using QuartoNotebookRunner",
        ],
        env: {
          // ignore the main env
          "JULIA_LOAD_PATH": isWindows ? "@;@stdlib" : "@:@stdlib",
        },
      });
      const qnrTestProc = qnrTestCommand.spawn();
      const result = await qnrTestProc.output();
      if (!result.success) {
        throw Error(
          `Executing \`using QuartoNotebookRunner\` failed with QUARTO_JULIA_PROJECT="${juliaProject}". Ensure that this project exists, has QuartoNotebookRunner installed and is instantiated correctly.`,
        );
      }
      trace(
        options,
        `QuartoNotebookRunner could be loaded successfully.`,
      );
    }

    // We need to spawn the julia server in its own process that can outlive quarto.
    // Apparently, `run(detach(cmd))` in julia does not do that reliably on Windows,
    // at least deno never seems to recognize that the spawning julia process has finished,
    // presumably because it waits for the active child process to exit. This makes the
    // tests on windows hang forever if we use the same launching mechanism as for Unix systems.
    // So we utilize powershell instead which can start completely detached processes with
    // the Start-Process commandlet.
    if (isWindows) {
      const command = new Deno.Command(
        "PowerShell",
        {
          args: [
            "-Command",
            "Start-Process",
            juliaCmd(),
            "-ArgumentList",
            powershell_argument_list_to_string(
              "--startup-file=no",
              `--project=${juliaProject}`,
              resourcePath("julia/quartonotebookrunner.jl"),
              transportFile,
              juliaServerLogFile(),
            ),
            "-WindowStyle",
            "Hidden",
          ],
          env: {
            "JULIA_LOAD_PATH": "@;@stdlib", // ignore the main env
          },
        },
      );
      trace(
        options,
        "Starting detached julia server through powershell, once transport file exists, server should be running.",
      );
      const result = command.outputSync();
      if (!result.success) {
        throw new Error(new TextDecoder().decode(result.stderr));
      }
    } else {
      const command = new Deno.Command(juliaCmd(), {
        args: [
          "--startup-file=no",
          resourcePath("julia/start_quartonotebookrunner_detached.jl"),
          juliaCmd(),
          juliaProject,
          resourcePath("julia/quartonotebookrunner.jl"),
          transportFile,
          juliaServerLogFile(),
        ],
        env: {
          "JULIA_LOAD_PATH": "@:@stdlib", // ignore the main env
        },
      });
      trace(
        options,
        "Starting detached julia server through julia, once transport file exists, server should be running.",
      );
      const result = command.outputSync();
      if (!result.success) {
        throw new Error(new TextDecoder().decode(result.stderr));
      }
    }
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
  const command = new Deno.Command(juliaCmd(), {
    args: [
      "--startup-file=no",
      `--project=${juliaRuntimeDir()}`,
      juliaResourcePath("ensure_environment.jl"),
    ],
  });
  const proc = command.spawn();
  const { success } = await proc.output();
  if (!success) {
    throw (new Error("Ensuring an updated julia server environment failed"));
  }
  return Promise.resolve();
}

function juliaResourcePath(...parts: string[]) {
  return join(resourcePath("julia"), ...parts);
}

interface JuliaTransportFile {
  port: number;
  pid: number;
  key: string;
  juliaVersion: string;
  environment: string;
  runnerVersion: string;
}

async function pollTransportFile(
  options: JuliaExecuteOptions,
): Promise<JuliaTransportFile> {
  const transportFile = juliaTransportFile();

  for (let i = 0; i < 15; i++) {
    if (existsSync(transportFile)) {
      const transportOptions = readTransportFile(transportFile);
      trace(options, "Transport file read successfully.");
      return transportOptions;
    }
    trace(options, "Transport file did not exist, yet.");
    await sleep(i * 100);
  }
  return Promise.reject();
}

function readTransportFile(transportFile: string): JuliaTransportFile {
  // As we know the json file ends with \n but we might accidentally read
  // it too quickly once it exists, for example when not the whole string
  // has been written to it, yet, we just repeat reading until the string
  // ends in a newline. The overhead doesn't matter as the file is so small.
  let content = Deno.readTextFileSync(transportFile);
  let i = 0;
  while (i < 20 && !content.endsWith("\n")) {
    sleep(100);
    content = Deno.readTextFileSync(transportFile);
    i += 1;
  }
  if (!content.endsWith("\n")) {
    throw ("Read invalid transport file that did not end with a newline");
  }
  return JSON.parse(content) as JuliaTransportFile;
}

async function getReadyServerConnection(
  transportOptions: JuliaTransportFile,
  executeOptions: JuliaExecuteOptions,
) {
  const conn = await Deno.connect({
    port: transportOptions.port,
  });
  const isready = writeJuliaCommand(
    conn,
    { type: "isready", content: {} },
    transportOptions.key,
    executeOptions,
  );
  const timeoutMilliseconds = 10000;
  const timeout = new Promise((accept, _) =>
    setTimeout(() => {
      accept(
        `Timed out after getting no response for ${timeoutMilliseconds} milliseconds.`,
      );
    }, timeoutMilliseconds)
  );
  const result = await Promise.race([isready, timeout]);
  if (typeof result === "string") {
    return result;
  } else if (result !== true) {
    conn.close();
    return `Expected isready command to return true, returned ${isready} instead. Closing connection.`;
  } else {
    return conn;
  }
}

async function getJuliaServerConnection(
  options: JuliaExecuteOptions,
): Promise<Deno.TcpConn> {
  const { reused } = await startOrReuseJuliaServer(options);

  let transportOptions: JuliaTransportFile;
  try {
    transportOptions = await pollTransportFile(options);
  } catch (err) {
    if (!reused) {
      info(
        "No transport file was found after the timeout. This is the log from the server process:",
      );
      info("#### BEGIN LOG ####");
      printJuliaServerLog();
      info("#### END LOG ####");
    }
    throw err;
  }

  if (!reused) {
    info("Julia server process started.");
  }

  trace(
    options,
    `Connecting to server at port ${transportOptions.port}, pid ${transportOptions.pid}`,
  );

  try {
    const conn = await getReadyServerConnection(transportOptions, options);
    if (typeof conn === "string") {
      // timed out or otherwise not ready
      throw new Error(conn);
    } else {
      return conn;
    }
  } catch (e) {
    if (reused) {
      trace(
        options,
        "Connecting to server failed, a transport file was reused so it might be stale. Delete transport file and retry.",
      );
      safeRemoveSync(juliaTransportFile());
      return await getJuliaServerConnection(options);
    } else {
      error(
        "Connecting to server failed. A transport file was successfully created by the server process, so something in the server process might be broken.",
      );
      throw e;
    }
  }
}

function firstSignificantLine(str: string, n: number): string {
  const lines = str.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Check if the line is significant
    if (!trimmedLine.startsWith("#|") && trimmedLine !== "") {
      // Return line as is if its length is less than or equal to n
      if (trimmedLine.length <= n) {
        return trimmedLine;
      } else {
        // Return substring up to n characters with an ellipsis
        return trimmedLine.substring(0, n - 1) + "…";
      }
    }
  }

  // Return empty string if no significant line found
  return "";
}

// from cliffy, MIT licensed
function getConsoleColumns(): number | null {
  try {
    // Catch error in none tty mode: Inappropriate ioctl for device (os error 25)
    return Deno.consoleSize().columns ?? null;
  } catch (_error) {
    return null;
  }
}

async function executeJulia(
  options: JuliaExecuteOptions,
): Promise<JupyterNotebook> {
  const conn = await getJuliaServerConnection(options);
  const transportOptions = await pollTransportFile(options);
  const file = options.target.input;
  if (options.oneShot || options.format.execute[kExecuteDaemonRestart]) {
    const isopen = await writeJuliaCommand(
      conn,
      { type: "isopen", content: { file } },
      transportOptions.key,
      options,
    );
    if (isopen) {
      await writeJuliaCommand(
        conn,
        { type: "close", content: { file } },
        transportOptions.key,
        options,
      );
    }
  }
  const response = await writeJuliaCommand(
    conn,
    { type: "run", content: { file, options } },
    transportOptions.key,
    options,
    (update: ProgressUpdate) => {
      const n = update.nChunks.toString();
      const i = update.chunkIndex.toString();
      const i_padded = `${" ".repeat(n.length - i.length)}${i}`;
      const ncols = getConsoleColumns() ?? 80;
      const firstPart = `Running [${i_padded}/${n}] at line ${update.line}:  `;
      const firstPartLength = firstPart.length;
      const sigLine = firstSignificantLine(
        update.source,
        Math.max(0, ncols - firstPartLength),
      );
      info(`${firstPart}${sigLine}`);
    },
  );

  if (options.oneShot) {
    await writeJuliaCommand(
      conn,
      { type: "close", content: { file } },
      transportOptions.key,
      options,
    );
  }

  return response.notebook;
}

interface ProgressUpdate {
  type: "progress_update";
  chunkIndex: number;
  nChunks: number;
  source: string;
  line: number;
}

type empty = Record<string | number | symbol, never>;

type ServerCommand =
  | { type: "run"; content: { file: string; options: JuliaExecuteOptions } }
  | { type: "close"; content: { file: string } }
  | { type: "forceclose"; content: { file: string } }
  | { type: "isopen"; content: { file: string } }
  | { type: "stop"; content: empty }
  | { type: "isready"; content: empty }
  | { type: "status"; content: empty };

type ServerCommandResponseMap = {
  run: { notebook: JupyterNotebook };
  close: { status: true };
  forceclose: { status: true };
  stop: { message: "Server stopped." };
  isopen: boolean;
  isready: true;
  status: string;
};

type ServerCommandError = {
  error: string;
  juliaError?: string;
};

type ServerCommandResponse<T extends ServerCommand["type"]> =
  ServerCommandResponseMap[T];

function isProgressUpdate(data: any): data is ProgressUpdate {
  return data && data.type === "progress_update";
}

function isServerCommandError(data: any): data is ServerCommandError {
  return data && typeof (data.error) === "string";
}

async function writeJuliaCommand<T extends ServerCommand["type"]>(
  conn: Deno.Conn,
  command: Extract<ServerCommand, { type: T }>,
  secret: string,
  options: JuliaExecuteOptions,
  onProgressUpdate?: (update: ProgressUpdate) => void,
): Promise<ServerCommandResponse<T>> {
  const payload = JSON.stringify(command);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign"],
  );
  const canonicalRequestBytes = new TextEncoder().encode(payload);
  const signatureArrayBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    canonicalRequestBytes,
  );
  const signatureBytes = new Uint8Array(signatureArrayBuffer);
  const hmac = encodeBase64(signatureBytes);

  const message = JSON.stringify({ hmac, payload }) + "\n";

  const messageBytes = new TextEncoder().encode(message);

  trace(options, `write command "${command.type}" to socket server`);
  const bytesWritten = await conn.write(messageBytes);
  if (bytesWritten !== messageBytes.length) {
    throw new Error("Internal Error");
  }

  // a string of bytes received from the server could start with a
  // partial message, contain multiple complete messages (separated by newlines) after that
  // but they could also end in a partial one.
  // so to read and process them all correctly, we read in a fixed number of bytes, if there's a newline, we process
  // the string up to that part and save the rest for the next round.
  let restOfPreviousResponse = new Uint8Array(512);
  let restLength = 0; // number of valid bytes in restOfPreviousResponse
  while (true) {
    const respArray: Uint8Array[] = [];
    let respLength = 0;
    let response = "";
    const newlineAt = restOfPreviousResponse.indexOf(10);
    // if we already have a newline, we don't need to read from conn
    if (newlineAt !== -1 && newlineAt < restLength) {
      response = new TextDecoder().decode(
        restOfPreviousResponse.slice(0, newlineAt),
      );
      restOfPreviousResponse.set(
        restOfPreviousResponse.slice(newlineAt + 1, restLength),
      );
      restLength -= newlineAt + 1;
    } // but if we don't have a newline, we read in more until we get one
    else {
      respArray.push(restOfPreviousResponse.slice(0, restLength));
      respLength += restLength;
      while (true) {
        const buffer = new Uint8Array(512);
        const bytesRead = await conn.read(buffer);
        if (bytesRead === null) {
          break;
        }

        if (bytesRead > 0) {
          const bufferNewlineAt = buffer.indexOf(10);
          if (bufferNewlineAt === -1 || bufferNewlineAt >= bytesRead) {
            respArray.push(buffer.slice(0, bytesRead));
            restLength = 0;
            respLength += bytesRead;
          } else {
            respArray.push(buffer.slice(0, bufferNewlineAt));
            respLength += bufferNewlineAt;
            restOfPreviousResponse.set(
              buffer.slice(bufferNewlineAt + 1, bytesRead),
            );
            restLength = bytesRead - bufferNewlineAt - 1;
            // when we have found a newline in a payload, we can stop reading in more data and continue
            // with the response first

            let respBuffer = new Uint8Array(respLength);
            let offset = 0;
            respArray.forEach((item) => {
              respBuffer.set(item, offset);
              offset += item.length;
            });
            response = new TextDecoder().decode(respBuffer);
            break;
          }
        }
      }
    }
    trace(options, "received server response");
    // one command should be sent, ended by a newline, currently just throwing away anything else because we don't
    // expect multiple commmands at once
    const json = response.split("\n")[0];
    const responseData = JSON.parse(json);

    if (isServerCommandError(responseData)) {
      const data = responseData;
      let errorMessage =
        `Julia server returned error after receiving "${command.type}" command:\n\n${data.error}`;

      if (data.juliaError) {
        errorMessage +=
          `\n\nThe underlying Julia error was:\n\n${data.juliaError}`;
      }

      throw new Error(errorMessage);
    }

    let data: ServerCommandResponse<T>;
    if (command.type === "run") {
      const data_or_update: ServerCommandResponse<T> | ProgressUpdate =
        responseData;
      if (isProgressUpdate(data_or_update)) {
        const update = data_or_update;
        trace(
          options,
          "received progress update response, listening for further responses",
        );
        if (onProgressUpdate !== undefined) {
          onProgressUpdate(update);
        }
        continue; // wait for the next message
      } else {
        data = data_or_update;
      }
    } else {
      data = responseData;
    }

    return data;
  }
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

export function juliaTransportFile() {
  return join(juliaRuntimeDir(), "julia_transport.txt");
}

export function juliaServerLogFile() {
  return join(juliaRuntimeDir(), "julia_server_log.txt");
}

function trace(options: ExecuteOptions, msg: string) {
  if (options.format?.execute[kExecuteDebug] === true) {
    info("- " + msg, { bold: true });
  }
}

function populateJuliaEngineCommand(command: Command) {
  command
    .command("status", "Status")
    .description(
      "Get status information on the currently running Julia server process.",
    ).action(logStatus)
    .command("kill", "Kill server")
    .description("Kill the control server if it is currently running. This will also kill all notebook worker processes.")
    .action(killJuliaServer)
    .command("log", "Print julia server log")
    .description(
      "Print the content of the julia server log file if it exists which can be used to diagnose problems.",
    )
    .action(printJuliaServerLog)
    .command(
      "close",
      "Close the worker for a given notebook. If it is currently running, it will not be interrupted.",
    )
    .arguments("<file:string>")
    .option(
      "-f, --force",
      "Force closing. This will terminate the worker if it is running.",
      { default: false },
    )
    .action(async (options, file) => {
      await closeWorker(file, options.force);
    })
    .command("stop", "Stop the server")
    .description(
      "Send a message to the server that it should close all notebooks and exit. This will fail if any notebooks are not idle.",
    )
    .action(stopServer);
  return;
}

async function logStatus() {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    info("Julia control server is not running.");
    return;
  }
  const transportOptions = readTransportFile(transportFile);

  const conn = await getReadyServerConnection(
    transportOptions,
    {} as JuliaExecuteOptions,
  );
  const successfullyConnected = typeof conn !== "string";

  if (successfullyConnected) {
    const status: string = await writeJuliaCommand(
      conn,
      { type: "status", content: {} },
      transportOptions.key,
      {} as JuliaExecuteOptions,
    );

    Deno.stdout.writeSync((new TextEncoder()).encode(status));

    conn.close();
  } else {
    info(`Found transport file but can't connect to control server.`);
  }
}

function killJuliaServer() {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    info("Julia control server is not running.");
    return;
  }
  const transportOptions = readTransportFile(transportFile);
  Deno.kill(transportOptions.pid, "SIGTERM");
  info("Sent SIGTERM to server process");
}

function printJuliaServerLog() {
  if (existsSync(juliaServerLogFile())) {
    Deno.stdout.writeSync(Deno.readFileSync(juliaServerLogFile()));
  } else {
    info("Server log file doesn't exist");
  }
  return;
}

// todo: this could use a refactor with the other functions that make
// server connections or execute commands, this one is just supposed to
// simplify the pattern where a running server is expected (there will be an error if there is none)
// and we want to get the API response out quickly
async function connectAndWriteJuliaCommandToRunningServer<
  T extends ServerCommand["type"],
>(
  command: Extract<ServerCommand, { type: T }>,
): Promise<ServerCommandResponse<T>> {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    throw new Error("Julia control server is not running.");
  }
  const transportOptions = readTransportFile(transportFile);

  const conn = await getReadyServerConnection(
    transportOptions,
    {} as JuliaExecuteOptions,
  );
  const successfullyConnected = typeof conn !== "string";

  if (successfullyConnected) {
    const result = await writeJuliaCommand(
      conn,
      command,
      transportOptions.key,
      {} as JuliaExecuteOptions,
    );
    conn.close();
    return result;
  } else {
    throw new Error(
      `Found transport file but can't connect to control server.`,
    );
  }
}

async function closeWorker(file: string, force: boolean) {
  const absfile = normalizePath(file);
  await connectAndWriteJuliaCommandToRunningServer({
    type: force ? "forceclose" : "close",
    content: { file: absfile },
  });
  info(`Worker ${force ? "force-" : ""}closed successfully.`);
}

async function stopServer() {
  const result = await connectAndWriteJuliaCommandToRunningServer({
    type: "stop",
    content: {},
  });
  info(result.message);
}
