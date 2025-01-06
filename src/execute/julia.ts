import { error, info } from "../deno_ral/log.ts";
import { join } from "../deno_ral/path.ts";
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
import { existsSync, safeRemoveSync } from "../deno_ral/fs.ts";
import { encodeBase64 } from "encoding/base64";
import {
  executeResultEngineDependencies,
  executeResultIncludes,
} from "./jupyter/jupyter.ts";
import { isWindows } from "../deno_ral/platform.ts";
import { Command } from "cliffy/command/mod.ts";

export interface JuliaExecuteOptions extends ExecuteOptions {
  oneShot: boolean; // if true, the file's worker process is closed before and after running
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
    // we don't claim `julia` so the old behavior of using the jupyter
    // backend by default stays intact
    return false; // language.toLowerCase() === "julia";
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
    return Promise.resolve(mappedStringFromFile(file));
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
            // string array argument list, each element but the last must have a "," element after
            "--startup-file=no",
            ",",
            `--project=${juliaProject}`,
            ",",
            resourcePath("julia/quartonotebookrunner.jl"),
            ",",
            transportFile,
            ",",
            juliaServerLogFile(),
            // end of string array
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
  ) as Promise<boolean>;
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
    ) as boolean;
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

  if (response.error !== undefined) {
    throw new Error("Running notebook failed:\n" + response.juliaError);
  }

  return response.notebook as JupyterNotebook;
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
  | { type: "isopen"; content: { file: string } }
  | { type: "stop"; content: empty }
  | { type: "isready"; content: empty }
  | { type: "workers"; content: empty };

async function writeJuliaCommand(
  conn: Deno.Conn,
  command: ServerCommand,
  secret: string,
  options: JuliaExecuteOptions,
  onProgressUpdate?: (update: ProgressUpdate) => void,
) {
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
    const data = JSON.parse(json);

    if (data.type === "progress_update") {
      trace(
        options,
        "received progress update response, listening for further responses",
      );
      if (onProgressUpdate !== undefined) {
        onProgressUpdate(data as ProgressUpdate);
      }
      continue; // wait for the next message
    }

    const err = data.error;
    if (err !== undefined) {
      const juliaError = data.juliaError ?? "No julia error message available.";
      error(
        `Julia server returned error after receiving "${command.type}" command:\n` +
          err,
      );
      error(juliaError);
      throw new Error("Internal julia server error");
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

function juliaTransportFile() {
  return join(juliaRuntimeDir(), "julia_transport.txt");
}

function juliaServerLogFile() {
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
      "Get status information on the currently running Julia server process",
    ).action(logStatus)
    .command("kill", "Kill server")
    .description("Kills the control server if it is currently running.")
    .action(killJuliaServer)
    .command("log", "Print julia server log")
    .description(
      "Prints the julia server log file if it exists which can be used to diagnose problems.",
    )
    .action(printJuliaServerLog);
  return;
}

type WorkerStatus = {
  path: string;
  run_started?: string;
  run_finished?: string;
  timeout: number;
};

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

  info(
    `Julia server is${successfullyConnected ? "" : " not"} responding.
  port: ${transportOptions.port}
  pid: ${transportOptions.pid}
  julia version: ${transportOptions.juliaVersion}
  environment: ${transportOptions.environment}
  runner version: ${transportOptions.runnerVersion}`,
  );

  if (successfullyConnected) {
    const workers = await writeJuliaCommand(
      conn,
      { type: "workers", content: {} },
      transportOptions.key,
      {} as JuliaExecuteOptions,
    ) as WorkerStatus[];
    info(`  workers active: ${workers.length}`);
    workers.forEach((worker, index) => {
      const runStarted = !worker.run_started
        ? undefined
        : new Date(worker.run_started);
      const runFinished = !worker.run_finished
        ? undefined
        : new Date(worker.run_finished);

      const secondsSinceStarted = runStarted !== undefined
        ? (Date.now() - runStarted.getTime()) / 1000
        : undefined;
      const runDurationSeconds =
        runStarted !== undefined && runFinished !== undefined
          ? (runFinished.getTime() - runStarted.getTime()) / 1000
          : undefined;
      const secondsSinceFinished = runFinished !== undefined
        ? (Date.now() - runFinished.getTime()) / 1000
        : undefined;
      const timeUntilTimeout =
        worker.timeout > 0 && secondsSinceFinished !== undefined
          ? worker.timeout - secondsSinceFinished
          : undefined;

      info(
        `    worker ${index + 1}:
      path: ${worker.path}      
      run started: ${runStarted ? simpleDateTimeString(runStarted) : "-"}${
          secondsSinceStarted
            ? ` (${formatSeconds(secondsSinceStarted)} ago)`
            : ""
        }    
      run finished: ${runFinished ? simpleDateTimeString(runFinished) : "-"}${
          runDurationSeconds
            ? ` (took ${formatSeconds(runDurationSeconds)})`
            : ""
        }    
      timeout: ${worker.timeout} seconds ${
          timeUntilTimeout ? `(${formatSeconds(timeUntilTimeout)} left)` : ""
        }
`,
      );
    });
    conn.close();
  }
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function simpleDateTimeString(date: Date) {
  const now = new Date();
  return isSameDay(date, now)
    ? date.toLocaleTimeString()
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatSeconds(seconds: number): string {
  seconds = Math.round(seconds);
  if (seconds < 60) {
    const s = seconds == 1 ? "" : "s";
    return `${seconds} second${s}`;
  } else if (seconds < 3600) {
    const rem_seconds = seconds % 60;
    const full_minutes = (seconds - rem_seconds) / 60;
    const s = full_minutes == 1 ? "" : "s";
    const seconds_str = rem_seconds == 0
      ? ""
      : ` ${formatSeconds(rem_seconds)}`;
    return `${full_minutes} minute${s}${seconds_str}`;
  } else {
    const rem_seconds = seconds % 3600;
    const full_hours = (seconds - rem_seconds) / 3600;
    const s = full_hours == 1 ? "" : "s";
    const minutes_str = rem_seconds == 0 ? "" : ` formatSeconds(rem_seconds)`;
    return `${full_hours} hour${s}${minutes_str}`;
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
