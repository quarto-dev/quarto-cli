// deno:https://jsr.io/@std/path/1.0.8/_os.ts
var isWindows = globalThis.Deno?.build.os === "windows" || globalThis.navigator?.platform?.startsWith("Win") || globalThis.process?.platform?.startsWith("win") || false;

// deno:https://jsr.io/@std/path/1.0.8/_common/assert_path.ts
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError(`Path must be a string, received "${JSON.stringify(path)}"`);
  }
}

// deno:https://jsr.io/@std/path/1.0.8/_common/constants.ts
var CHAR_UPPERCASE_A = 65;
var CHAR_LOWERCASE_A = 97;
var CHAR_UPPERCASE_Z = 90;
var CHAR_LOWERCASE_Z = 122;
var CHAR_DOT = 46;
var CHAR_FORWARD_SLASH = 47;
var CHAR_BACKWARD_SLASH = 92;
var CHAR_COLON = 58;

// deno:https://jsr.io/@std/path/1.0.8/posix/_util.ts
function isPosixPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH;
}

// deno:https://jsr.io/@std/path/1.0.8/windows/_util.ts
function isPathSeparator(code) {
  return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
}
function isWindowsDeviceRoot(code) {
  return code >= CHAR_LOWERCASE_A && code <= CHAR_LOWERCASE_Z || code >= CHAR_UPPERCASE_A && code <= CHAR_UPPERCASE_Z;
}

// deno:https://jsr.io/@std/path/1.0.8/_common/normalize.ts
function assertArg4(path) {
  assertPath(path);
  if (path.length === 0) return ".";
}

// deno:https://jsr.io/@std/path/1.0.8/_common/normalize_string.ts
function normalizeString(path, allowAboveRoot, separator, isPathSeparator2) {
  let res = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let code;
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    else if (isPathSeparator2(code)) break;
    else code = CHAR_FORWARD_SLASH;
    if (isPathSeparator2(code)) {
      if (lastSlash === i - 1 || dots === 1) {
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (res.length < 2 || lastSegmentLength !== 2 || res.charCodeAt(res.length - 1) !== CHAR_DOT || res.charCodeAt(res.length - 2) !== CHAR_DOT) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            if (lastSlashIndex === -1) {
              res = "";
              lastSegmentLength = 0;
            } else {
              res = res.slice(0, lastSlashIndex);
              lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
            }
            lastSlash = i;
            dots = 0;
            continue;
          } else if (res.length === 2 || res.length === 1) {
            res = "";
            lastSegmentLength = 0;
            lastSlash = i;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          if (res.length > 0) res += `${separator}..`;
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      lastSlash = i;
      dots = 0;
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
    } else {
      dots = -1;
    }
  }
  return res;
}

// deno:https://jsr.io/@std/path/1.0.8/posix/normalize.ts
function normalize(path) {
  assertArg4(path);
  const isAbsolute3 = isPosixPathSeparator(path.charCodeAt(0));
  const trailingSeparator = isPosixPathSeparator(path.charCodeAt(path.length - 1));
  path = normalizeString(path, !isAbsolute3, "/", isPosixPathSeparator);
  if (path.length === 0 && !isAbsolute3) path = ".";
  if (path.length > 0 && trailingSeparator) path += "/";
  if (isAbsolute3) return `/${path}`;
  return path;
}

// deno:https://jsr.io/@std/path/1.0.8/posix/join.ts
function join(...paths) {
  if (paths.length === 0) return ".";
  paths.forEach((path) => assertPath(path));
  const joined = paths.filter((path) => path.length > 0).join("/");
  return joined === "" ? "." : normalize(joined);
}

// deno:https://jsr.io/@std/path/1.0.8/windows/normalize.ts
function normalize2(path) {
  assertArg4(path);
  const len = path.length;
  let rootEnd = 0;
  let device;
  let isAbsolute3 = false;
  const code = path.charCodeAt(0);
  if (len > 1) {
    if (isPathSeparator(code)) {
      isAbsolute3 = true;
      if (isPathSeparator(path.charCodeAt(1))) {
        let j = 2;
        let last = j;
        for (; j < len; ++j) {
          if (isPathSeparator(path.charCodeAt(j))) break;
        }
        if (j < len && j !== last) {
          const firstPart = path.slice(last, j);
          last = j;
          for (; j < len; ++j) {
            if (!isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            last = j;
            for (; j < len; ++j) {
              if (isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j === len) {
              return `\\\\${firstPart}\\${path.slice(last)}\\`;
            } else if (j !== last) {
              device = `\\\\${firstPart}\\${path.slice(last, j)}`;
              rootEnd = j;
            }
          }
        }
      } else {
        rootEnd = 1;
      }
    } else if (isWindowsDeviceRoot(code)) {
      if (path.charCodeAt(1) === CHAR_COLON) {
        device = path.slice(0, 2);
        rootEnd = 2;
        if (len > 2) {
          if (isPathSeparator(path.charCodeAt(2))) {
            isAbsolute3 = true;
            rootEnd = 3;
          }
        }
      }
    }
  } else if (isPathSeparator(code)) {
    return "\\";
  }
  let tail;
  if (rootEnd < len) {
    tail = normalizeString(path.slice(rootEnd), !isAbsolute3, "\\", isPathSeparator);
  } else {
    tail = "";
  }
  if (tail.length === 0 && !isAbsolute3) tail = ".";
  if (tail.length > 0 && isPathSeparator(path.charCodeAt(len - 1))) {
    tail += "\\";
  }
  if (device === void 0) {
    if (isAbsolute3) {
      if (tail.length > 0) return `\\${tail}`;
      else return "\\";
    }
    return tail;
  } else if (isAbsolute3) {
    if (tail.length > 0) return `${device}\\${tail}`;
    else return `${device}\\`;
  }
  return device + tail;
}

// deno:https://jsr.io/@std/path/1.0.8/windows/join.ts
function join2(...paths) {
  paths.forEach((path) => assertPath(path));
  paths = paths.filter((path) => path.length > 0);
  if (paths.length === 0) return ".";
  let needsReplace = true;
  let slashCount = 0;
  const firstPart = paths[0];
  if (isPathSeparator(firstPart.charCodeAt(0))) {
    ++slashCount;
    const firstLen = firstPart.length;
    if (firstLen > 1) {
      if (isPathSeparator(firstPart.charCodeAt(1))) {
        ++slashCount;
        if (firstLen > 2) {
          if (isPathSeparator(firstPart.charCodeAt(2))) ++slashCount;
          else {
            needsReplace = false;
          }
        }
      }
    }
  }
  let joined = paths.join("\\");
  if (needsReplace) {
    for (; slashCount < joined.length; ++slashCount) {
      if (!isPathSeparator(joined.charCodeAt(slashCount))) break;
    }
    if (slashCount >= 2) joined = `\\${joined.slice(slashCount)}`;
  }
  return normalize2(joined);
}

// deno:https://jsr.io/@std/path/1.0.8/join.ts
function join3(...paths) {
  return isWindows ? join2(...paths) : join(...paths);
}

// deno:https://jsr.io/@std/path/1.0.8/posix/resolve.ts
function resolve(...pathSegments) {
  let resolvedPath = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    let path;
    if (i >= 0) path = pathSegments[i];
    else {
      const { Deno: Deno2 } = globalThis;
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a current working directory (CWD)");
      }
      path = Deno2.cwd();
    }
    assertPath(path);
    if (path.length === 0) {
      continue;
    }
    resolvedPath = `${path}/${resolvedPath}`;
    resolvedAbsolute = isPosixPathSeparator(path.charCodeAt(0));
  }
  resolvedPath = normalizeString(resolvedPath, !resolvedAbsolute, "/", isPosixPathSeparator);
  if (resolvedAbsolute) {
    if (resolvedPath.length > 0) return `/${resolvedPath}`;
    else return "/";
  } else if (resolvedPath.length > 0) return resolvedPath;
  else return ".";
}

// deno:https://jsr.io/@std/path/1.0.8/windows/resolve.ts
function resolve2(...pathSegments) {
  let resolvedDevice = "";
  let resolvedTail = "";
  let resolvedAbsolute = false;
  for (let i = pathSegments.length - 1; i >= -1; i--) {
    let path;
    const { Deno: Deno2 } = globalThis;
    if (i >= 0) {
      path = pathSegments[i];
    } else if (!resolvedDevice) {
      if (typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a drive-letter-less path without a current working directory (CWD)");
      }
      path = Deno2.cwd();
    } else {
      if (typeof Deno2?.env?.get !== "function" || typeof Deno2?.cwd !== "function") {
        throw new TypeError("Resolved a relative path without a current working directory (CWD)");
      }
      path = Deno2.cwd();
      if (path === void 0 || path.slice(0, 3).toLowerCase() !== `${resolvedDevice.toLowerCase()}\\`) {
        path = `${resolvedDevice}\\`;
      }
    }
    assertPath(path);
    const len = path.length;
    if (len === 0) continue;
    let rootEnd = 0;
    let device = "";
    let isAbsolute3 = false;
    const code = path.charCodeAt(0);
    if (len > 1) {
      if (isPathSeparator(code)) {
        isAbsolute3 = true;
        if (isPathSeparator(path.charCodeAt(1))) {
          let j = 2;
          let last = j;
          for (; j < len; ++j) {
            if (isPathSeparator(path.charCodeAt(j))) break;
          }
          if (j < len && j !== last) {
            const firstPart = path.slice(last, j);
            last = j;
            for (; j < len; ++j) {
              if (!isPathSeparator(path.charCodeAt(j))) break;
            }
            if (j < len && j !== last) {
              last = j;
              for (; j < len; ++j) {
                if (isPathSeparator(path.charCodeAt(j))) break;
              }
              if (j === len) {
                device = `\\\\${firstPart}\\${path.slice(last)}`;
                rootEnd = j;
              } else if (j !== last) {
                device = `\\\\${firstPart}\\${path.slice(last, j)}`;
                rootEnd = j;
              }
            }
          }
        } else {
          rootEnd = 1;
        }
      } else if (isWindowsDeviceRoot(code)) {
        if (path.charCodeAt(1) === CHAR_COLON) {
          device = path.slice(0, 2);
          rootEnd = 2;
          if (len > 2) {
            if (isPathSeparator(path.charCodeAt(2))) {
              isAbsolute3 = true;
              rootEnd = 3;
            }
          }
        }
      }
    } else if (isPathSeparator(code)) {
      rootEnd = 1;
      isAbsolute3 = true;
    }
    if (device.length > 0 && resolvedDevice.length > 0 && device.toLowerCase() !== resolvedDevice.toLowerCase()) {
      continue;
    }
    if (resolvedDevice.length === 0 && device.length > 0) {
      resolvedDevice = device;
    }
    if (!resolvedAbsolute) {
      resolvedTail = `${path.slice(rootEnd)}\\${resolvedTail}`;
      resolvedAbsolute = isAbsolute3;
    }
    if (resolvedAbsolute && resolvedDevice.length > 0) break;
  }
  resolvedTail = normalizeString(resolvedTail, !resolvedAbsolute, "\\", isPathSeparator);
  return resolvedDevice + (resolvedAbsolute ? "\\" : "") + resolvedTail || ".";
}

// deno:https://jsr.io/@std/path/1.0.8/resolve.ts
function resolve3(...pathSegments) {
  return isWindows ? resolve2(...pathSegments) : resolve(...pathSegments);
}

// deno:https://jsr.io/@std/fs/1.0.16/exists.ts
function existsSync(path, options) {
  try {
    const stat = Deno.statSync(path);
    if (options && (options.isReadable || options.isDirectory || options.isFile)) {
      if (options.isDirectory && options.isFile) {
        throw new TypeError("ExistsOptions.options.isDirectory and ExistsOptions.options.isFile must not be true together");
      }
      if (options.isDirectory && !stat.isDirectory || options.isFile && !stat.isFile) {
        return false;
      }
      if (options.isReadable) {
        return fileIsReadable(stat);
      }
    }
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    if (error instanceof Deno.errors.PermissionDenied) {
      if (Deno.permissions.querySync({
        name: "read",
        path
      }).state === "granted") {
        return !options?.isReadable;
      }
    }
    throw error;
  }
}
function fileIsReadable(stat) {
  if (stat.mode === null) {
    return true;
  } else if (Deno.uid() === stat.uid) {
    return (stat.mode & 256) === 256;
  } else if (Deno.gid() === stat.gid) {
    return (stat.mode & 32) === 32;
  }
  return (stat.mode & 4) === 4;
}

// deno:https://jsr.io/@std/encoding/1.0.9/_common64.ts
var padding = "=".charCodeAt(0);
var alphabet = {
  Base64: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"),
  Base64Url: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
};
var rAlphabet = {
  Base64: new Uint8Array(128).fill(64),
  Base64Url: new Uint8Array(128).fill(64)
};
alphabet.Base64.forEach((byte, i) => rAlphabet.Base64[byte] = i);
alphabet.Base64Url.forEach((byte, i) => rAlphabet.Base64Url[byte] = i);
function calcSizeBase64(originalSize) {
  return ((originalSize + 2) / 3 | 0) * 4;
}
function encode(buffer, i, o, alphabet3, padding3) {
  i += 2;
  for (; i < buffer.length; i += 3) {
    const x = buffer[i - 2] << 16 | buffer[i - 1] << 8 | buffer[i];
    buffer[o++] = alphabet3[x >> 18];
    buffer[o++] = alphabet3[x >> 12 & 63];
    buffer[o++] = alphabet3[x >> 6 & 63];
    buffer[o++] = alphabet3[x & 63];
  }
  switch (i) {
    case buffer.length + 1: {
      const x = buffer[i - 2] << 16;
      buffer[o++] = alphabet3[x >> 18];
      buffer[o++] = alphabet3[x >> 12 & 63];
      buffer[o++] = padding3;
      buffer[o++] = padding3;
      break;
    }
    case buffer.length: {
      const x = buffer[i - 2] << 16 | buffer[i - 1] << 8;
      buffer[o++] = alphabet3[x >> 18];
      buffer[o++] = alphabet3[x >> 12 & 63];
      buffer[o++] = alphabet3[x >> 6 & 63];
      buffer[o++] = padding3;
      break;
    }
  }
  return o;
}

// deno:https://jsr.io/@std/encoding/1.0.9/_common_detach.ts
function detach(buffer, maxSize) {
  const originalSize = buffer.length;
  if (buffer.byteOffset) {
    const b = new Uint8Array(buffer.buffer);
    b.set(buffer);
    buffer = b.subarray(0, originalSize);
  }
  buffer = new Uint8Array(buffer.buffer.transfer(maxSize));
  buffer.set(buffer.subarray(0, originalSize), maxSize - originalSize);
  return [
    buffer,
    maxSize - originalSize
  ];
}

// deno:https://jsr.io/@std/encoding/1.0.9/base64.ts
var padding2 = "=".charCodeAt(0);
var alphabet2 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var rAlphabet2 = new Uint8Array(128).fill(64);
alphabet2.forEach((byte, i) => rAlphabet2[byte] = i);
function encodeBase64(data) {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(data, calcSizeBase64(data.length));
  encode(output, i, 0, alphabet2, padding2);
  return new TextDecoder().decode(output);
}

// src/constants.ts
var kJuliaEngine = "julia";
var kExecuteDaemon = "daemon";
var kExecuteDaemonRestart = "daemon-restart";
var kExecuteDebug = "debug";
var kFigDpi = "fig-dpi";
var kFigFormat = "fig-format";
var kFigPos = "fig-pos";
var kIpynbProduceSourceNotebook = "produce-source-notebook";
var kKeepHidden = "keep-hidden";

// src/julia-engine.ts
var isWindows2 = Deno.build.os === "windows";
var quarto;
function safeRemoveSync(file, options = {}) {
  try {
    Deno.removeSync(file, options);
  } catch (e) {
    if (existsSync(file)) {
      throw e;
    }
  }
}
var delay = (ms) => new Promise((resolve4) => setTimeout(resolve4, ms));
var juliaEngineDiscovery = {
  init: (quartoAPI) => {
    quarto = quartoAPI;
  },
  name: kJuliaEngine,
  defaultExt: ".qmd",
  defaultYaml: () => [],
  defaultContent: () => [
    "```{julia}",
    "1 + 1",
    "```"
  ],
  validExtensions: () => [],
  claimsFile: (file, _ext) => {
    return quarto.jupyter.isPercentScript(file, [
      ".jl"
    ]);
  },
  claimsLanguage: (language) => {
    return language.toLowerCase() === "julia";
  },
  canFreeze: true,
  generatesFigures: true,
  ignoreDirs: () => {
    return [];
  },
  /**
   * Populate engine-specific CLI commands
   */
  populateCommand: (command) => populateJuliaEngineCommand(command),
  /**
   * Check Julia installation
   */
  checkInstallation: async () => {
    await quarto.console.withSpinner({
      message: "Checking Julia installation..."
    }, async () => {
      await delay(3e3);
    });
  },
  /**
   * Launch a dynamic execution engine with project context
   */
  launch: (context) => {
    return {
      name: juliaEngineDiscovery.name,
      canFreeze: juliaEngineDiscovery.canFreeze,
      partitionedMarkdown: (file) => {
        return Promise.resolve(quarto.markdownRegex.partition(Deno.readTextFileSync(file)));
      },
      // TODO: ask dragonstyle what to do here
      executeTargetSkipped: () => false,
      // TODO: just return dependencies from execute and this can do nothing
      dependencies: (_options) => {
        const includes = {};
        return Promise.resolve({
          includes
        });
      },
      // TODO: this can also probably do nothing
      postprocess: (_options) => {
        return Promise.resolve();
      },
      canKeepSource: (_target) => {
        return true;
      },
      markdownForFile(file) {
        if (quarto.jupyter.isPercentScript(file, [
          ".jl"
        ])) {
          return Promise.resolve(quarto.mappedString.fromString(quarto.jupyter.percentScriptToMarkdown(file)));
        } else {
          return Promise.resolve(quarto.mappedString.fromFile(file));
        }
      },
      execute: async (options) => {
        options.target.source;
        let executeDaemon = options.format.execute[kExecuteDaemon];
        if (executeDaemon === null || executeDaemon === void 0) {
          executeDaemon = quarto.system.isInteractiveSession() && !quarto.system.runningInCI();
        }
        const execOptions = {
          ...options,
          target: {
            ...options.target,
            input: quarto.path.absolute(options.target.input)
          }
        };
        const juliaExecOptions = {
          oneShot: !executeDaemon,
          ...execOptions
        };
        const nb = await executeJulia(juliaExecOptions);
        if (!nb) {
          quarto.console.error("Execution of notebook returned undefined");
          return Promise.reject();
        }
        nb.metadata.kernelspec = {
          display_name: "Julia",
          name: "julia",
          language: "julia"
        };
        const assets = quarto.jupyter.assets(options.target.input, options.format.pandoc.to);
        const result = await quarto.jupyter.toMarkdown(nb, {
          executeOptions: options,
          language: nb.metadata.kernelspec.language.toLowerCase(),
          assets,
          execute: options.format.execute,
          keepHidden: options.format.render[kKeepHidden],
          toHtml: quarto.format.isHtmlCompatible(options.format),
          toLatex: quarto.format.isLatexOutput(options.format.pandoc),
          toMarkdown: quarto.format.isMarkdownOutput(options.format),
          toIpynb: quarto.format.isIpynbOutput(options.format.pandoc),
          toPresentation: quarto.format.isPresentationOutput(options.format.pandoc),
          figFormat: options.format.execute[kFigFormat],
          figDpi: options.format.execute[kFigDpi],
          figPos: options.format.render[kFigPos],
          // preserveCellMetadata,
          preserveCodeCellYaml: options.format.render[kIpynbProduceSourceNotebook] === true
        });
        let includes;
        let engineDependencies;
        if (options.dependencies) {
          includes = quarto.jupyter.resultIncludes(options.tempDir, result.dependencies);
        } else {
          const dependencies = quarto.jupyter.resultEngineDependencies(result.dependencies);
          if (dependencies) {
            engineDependencies = {
              [kJuliaEngine]: dependencies
            };
          }
        }
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
        return {
          engine: kJuliaEngine,
          markdown,
          supporting: [
            join3(assets.base_dir, assets.supporting_dir)
          ],
          filters: [],
          pandoc: result.pandoc,
          includes,
          engineDependencies,
          preserve: result.htmlPreserve,
          postProcess: result.htmlPreserve && Object.keys(result.htmlPreserve).length > 0
        };
      },
      target: (file, _quiet, markdown) => {
        if (markdown === void 0) {
          markdown = quarto.mappedString.fromFile(file);
        }
        const target = {
          source: file,
          input: file,
          markdown,
          metadata: quarto.markdownRegex.extractYaml(markdown.value)
        };
        return Promise.resolve(target);
      }
    };
  }
};
var julia_engine_default = juliaEngineDiscovery;
function juliaCmd() {
  return Deno.env.get("QUARTO_JULIA") ?? "julia";
}
function powershell_argument_list_to_string(...args) {
  const inner = args.map((arg) => `"${arg}"`).join(" ");
  return `'${inner}'`;
}
async function startOrReuseJuliaServer(options) {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    trace(options, `Transport file ${transportFile} doesn't exist`);
    quarto.console.info("Starting julia control server process. This might take a while...");
    let juliaProject = Deno.env.get("QUARTO_JULIA_PROJECT");
    if (juliaProject === void 0) {
      await ensureQuartoNotebookRunnerEnvironment(options);
      juliaProject = quarto.path.runtime("julia");
    } else {
      juliaProject = quarto.path.toForwardSlashes(juliaProject);
      trace(options, `Custom julia project set via QUARTO_JULIA_PROJECT="${juliaProject}". Checking if QuartoNotebookRunner can be loaded.`);
      const qnrTestCommand = new Deno.Command(juliaCmd(), {
        args: [
          "--startup-file=no",
          `--project=${juliaProject}`,
          "-e",
          "using QuartoNotebookRunner"
        ],
        env: {
          // ignore the main env
          "JULIA_LOAD_PATH": isWindows2 ? "@;@stdlib" : "@:@stdlib"
        }
      });
      const qnrTestProc = qnrTestCommand.spawn();
      const result = await qnrTestProc.output();
      if (!result.success) {
        throw Error(`Executing \`using QuartoNotebookRunner\` failed with QUARTO_JULIA_PROJECT="${juliaProject}". Ensure that this project exists, has QuartoNotebookRunner installed and is instantiated correctly.`);
      }
      trace(options, `QuartoNotebookRunner could be loaded successfully.`);
    }
    if (isWindows2) {
      const command = new Deno.Command("PowerShell", {
        args: [
          "-Command",
          "Start-Process",
          juliaCmd(),
          "-ArgumentList",
          powershell_argument_list_to_string("--startup-file=no", `--project=${juliaProject}`, quarto.path.resource("julia", "quartonotebookrunner.jl"), transportFile, juliaServerLogFile()),
          "-WindowStyle",
          "Hidden"
        ],
        env: {
          "JULIA_LOAD_PATH": "@;@stdlib"
        }
      });
      trace(options, "Starting detached julia server through powershell, once transport file exists, server should be running.");
      const result = command.outputSync();
      if (!result.success) {
        throw new Error(new TextDecoder().decode(result.stderr));
      }
    } else {
      const command = new Deno.Command(juliaCmd(), {
        args: [
          "--startup-file=no",
          quarto.path.resource("julia", "start_quartonotebookrunner_detached.jl"),
          juliaCmd(),
          juliaProject,
          quarto.path.resource("julia", "quartonotebookrunner.jl"),
          transportFile,
          juliaServerLogFile()
        ],
        env: {
          "JULIA_LOAD_PATH": "@:@stdlib"
        }
      });
      trace(options, "Starting detached julia server through julia, once transport file exists, server should be running.");
      const result = command.outputSync();
      if (!result.success) {
        throw new Error(new TextDecoder().decode(result.stderr));
      }
    }
  } else {
    trace(options, `Transport file ${transportFile} exists, reusing server.`);
    return {
      reused: true
    };
  }
  return {
    reused: false
  };
}
async function ensureQuartoNotebookRunnerEnvironment(options) {
  const runtimeDir = quarto.path.runtime("julia");
  const projectTomlTemplate = quarto.path.resource("julia", "Project.toml");
  const projectToml = join3(runtimeDir, "Project.toml");
  Deno.writeFileSync(projectToml, Deno.readFileSync(projectTomlTemplate));
  const command = new Deno.Command(juliaCmd(), {
    args: [
      "--startup-file=no",
      `--project=${runtimeDir}`,
      quarto.path.resource("julia", "ensure_environment.jl")
    ]
  });
  const proc = command.spawn();
  const { success } = await proc.output();
  if (!success) {
    throw new Error("Ensuring an updated julia server environment failed");
  }
  return Promise.resolve();
}
async function pollTransportFile(options) {
  const transportFile = juliaTransportFile();
  for (let i = 0; i < 15; i++) {
    if (existsSync(transportFile)) {
      const transportOptions = await readTransportFile(transportFile);
      trace(options, "Transport file read successfully.");
      return transportOptions;
    }
    trace(options, "Transport file did not exist, yet.");
    await delay(i * 100);
  }
  return Promise.reject();
}
async function readTransportFile(transportFile) {
  let content = Deno.readTextFileSync(transportFile);
  let i = 0;
  while (i < 20 && !content.endsWith("\n")) {
    await delay(100);
    content = Deno.readTextFileSync(transportFile);
    i += 1;
  }
  if (!content.endsWith("\n")) {
    throw "Read invalid transport file that did not end with a newline";
  }
  return JSON.parse(content);
}
async function getReadyServerConnection(transportOptions, executeOptions) {
  const conn = await Deno.connect({
    port: transportOptions.port
  });
  const isready = writeJuliaCommand(conn, {
    type: "isready",
    content: {}
  }, transportOptions.key, executeOptions);
  const timeoutMilliseconds = 1e4;
  const timeout = new Promise((accept, _) => setTimeout(() => {
    accept(`Timed out after getting no response for ${timeoutMilliseconds} milliseconds.`);
  }, timeoutMilliseconds));
  const result = await Promise.race([
    isready,
    timeout
  ]);
  if (typeof result === "string") {
    return result;
  } else if (result !== true) {
    conn.close();
    return `Expected isready command to return true, returned ${isready} instead. Closing connection.`;
  } else {
    return conn;
  }
}
async function getJuliaServerConnection(options) {
  const { reused } = await startOrReuseJuliaServer(options);
  let transportOptions;
  try {
    transportOptions = await pollTransportFile(options);
  } catch (err) {
    if (!reused) {
      quarto.console.info("No transport file was found after the timeout. This is the log from the server process:");
      quarto.console.info("#### BEGIN LOG ####");
      printJuliaServerLog();
      quarto.console.info("#### END LOG ####");
    }
    throw err;
  }
  if (!reused) {
    quarto.console.info("Julia server process started.");
  }
  trace(options, `Connecting to server at port ${transportOptions.port}, pid ${transportOptions.pid}`);
  try {
    const conn = await getReadyServerConnection(transportOptions, options);
    if (typeof conn === "string") {
      throw new Error(conn);
    } else {
      return conn;
    }
  } catch (e) {
    if (reused) {
      trace(options, "Connecting to server failed, a transport file was reused so it might be stale. Delete transport file and retry.");
      safeRemoveSync(juliaTransportFile());
      return await getJuliaServerConnection(options);
    } else {
      quarto.console.error("Connecting to server failed. A transport file was successfully created by the server process, so something in the server process might be broken.");
      throw e;
    }
  }
}
function firstSignificantLine(str, n) {
  const lines = str.split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith("#|") && trimmedLine !== "") {
      if (trimmedLine.length <= n) {
        return trimmedLine;
      } else {
        return trimmedLine.substring(0, n - 1) + "\u2026";
      }
    }
  }
  return "";
}
function getConsoleColumns() {
  try {
    return Deno.consoleSize().columns ?? null;
  } catch (_error) {
    return null;
  }
}
function buildSourceRanges(markdown) {
  const lines = quarto.mappedString.splitLines(markdown);
  const sourceRanges = [];
  let currentRange = null;
  lines.forEach((line, index) => {
    const mapResult = line.map(0, true);
    if (mapResult) {
      const { originalString } = mapResult;
      const lineCol = quarto.mappedString.indexToLineCol(originalString, mapResult.index);
      const fileName = originalString.fileName ? resolve3(originalString.fileName) : void 0;
      const sourceLineNum = lineCol.line;
      if (currentRange && currentRange.file === fileName && fileName !== void 0 && currentRange.sourceLines && currentRange.sourceLines[1] === sourceLineNum) {
        currentRange.lines[1] = index + 1;
        currentRange.sourceLines[1] = sourceLineNum + 1;
      } else {
        if (currentRange) {
          sourceRanges.push(currentRange);
        }
        currentRange = {
          lines: [
            index + 1,
            index + 1
          ]
        };
        if (fileName !== void 0) {
          currentRange.file = fileName;
          currentRange.sourceLines = [
            sourceLineNum + 1,
            sourceLineNum + 1
          ];
        }
      }
    } else {
      if (currentRange) {
        sourceRanges.push(currentRange);
        currentRange = null;
      }
    }
  });
  if (currentRange) {
    sourceRanges.push(currentRange);
  }
  return sourceRanges;
}
async function executeJulia(options) {
  const conn = await getJuliaServerConnection(options);
  const transportOptions = await pollTransportFile(options);
  const file = options.target.input;
  if (options.oneShot || options.format.execute[kExecuteDaemonRestart]) {
    const isopen = await writeJuliaCommand(conn, {
      type: "isopen",
      content: {
        file
      }
    }, transportOptions.key, options);
    if (isopen) {
      await writeJuliaCommand(conn, {
        type: "close",
        content: {
          file
        }
      }, transportOptions.key, options);
    }
  }
  const sourceRanges = buildSourceRanges(options.target.markdown);
  const response = await writeJuliaCommand(conn, {
    type: "run",
    content: {
      file,
      options,
      sourceRanges
    }
  }, transportOptions.key, options, (update) => {
    const n = update.nChunks.toString();
    const i = update.chunkIndex.toString();
    const i_padded = `${" ".repeat(n.length - i.length)}${i}`;
    const ncols = getConsoleColumns() ?? 80;
    const firstPart = `Running [${i_padded}/${n}] at line ${update.line}:  `;
    const firstPartLength = firstPart.length;
    const sigLine = firstSignificantLine(update.source, Math.max(0, ncols - firstPartLength));
    quarto.console.info(`${firstPart}${sigLine}`);
  });
  if (options.oneShot) {
    await writeJuliaCommand(conn, {
      type: "close",
      content: {
        file
      }
    }, transportOptions.key, options);
  }
  return response.notebook;
}
function isProgressUpdate(data) {
  return data && data.type === "progress_update";
}
function isServerCommandError(data) {
  return data && typeof data.error === "string";
}
async function writeJuliaCommand(conn, command, secret, options, onProgressUpdate) {
  const payload = JSON.stringify(command);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, true, [
    "sign"
  ]);
  const canonicalRequestBytes = new TextEncoder().encode(payload);
  const signatureArrayBuffer = await crypto.subtle.sign("HMAC", key, canonicalRequestBytes);
  const signatureBytes = new Uint8Array(signatureArrayBuffer);
  const hmac = encodeBase64(signatureBytes);
  const message = JSON.stringify({
    hmac,
    payload
  }) + "\n";
  const messageBytes = new TextEncoder().encode(message);
  trace(options, `write command "${command.type}" to socket server`);
  const bytesWritten = await conn.write(messageBytes);
  if (bytesWritten !== messageBytes.length) {
    throw new Error("Internal Error");
  }
  let restOfPreviousResponse = new Uint8Array(512);
  let restLength = 0;
  while (true) {
    const respArray = [];
    let respLength = 0;
    let response = "";
    const newlineAt = restOfPreviousResponse.indexOf(10);
    if (newlineAt !== -1 && newlineAt < restLength) {
      response = new TextDecoder().decode(restOfPreviousResponse.slice(0, newlineAt));
      restOfPreviousResponse.set(restOfPreviousResponse.slice(newlineAt + 1, restLength));
      restLength -= newlineAt + 1;
    } else {
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
            restOfPreviousResponse.set(buffer.slice(bufferNewlineAt + 1, bytesRead));
            restLength = bytesRead - bufferNewlineAt - 1;
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
    const json = response.split("\n")[0];
    const responseData = JSON.parse(json);
    if (isServerCommandError(responseData)) {
      const data2 = responseData;
      let errorMessage = `Julia server returned error after receiving "${command.type}" command:

${data2.error}`;
      if (data2.juliaError) {
        errorMessage += `

The underlying Julia error was:

${data2.juliaError}`;
      }
      throw new Error(errorMessage);
    }
    let data;
    if (command.type === "run") {
      const data_or_update = responseData;
      if (isProgressUpdate(data_or_update)) {
        const update = data_or_update;
        trace(options, "received progress update response, listening for further responses");
        if (onProgressUpdate !== void 0) {
          onProgressUpdate(update);
        }
        continue;
      } else {
        data = data_or_update;
      }
    } else {
      data = responseData;
    }
    return data;
  }
}
function juliaRuntimeDir() {
  try {
    return quarto.path.runtime("julia");
  } catch (e) {
    quarto.console.error("Could not create julia runtime directory.");
    quarto.console.error("This is possibly a permission issue in the environment Quarto is running in.");
    quarto.console.error("Please consult the following documentation for more information:");
    quarto.console.error("https://github.com/quarto-dev/quarto-cli/issues/4594#issuecomment-1619177667");
    throw e;
  }
}
function juliaTransportFile() {
  return join3(juliaRuntimeDir(), "julia_transport.txt");
}
function juliaServerLogFile() {
  return join3(juliaRuntimeDir(), "julia_server_log.txt");
}
function trace(options, msg) {
  if (options.format?.execute[kExecuteDebug] === true) {
    quarto.console.info("- " + msg, {
      bold: true
    });
  }
}
function populateJuliaEngineCommand(command) {
  command.command("status", "Status").description("Get status information on the currently running Julia server process.").action(logStatus).command("kill", "Kill server").description("Kill the control server if it is currently running. This will also kill all notebook worker processes.").action(killJuliaServer).command("log", "Print julia server log").description("Print the content of the julia server log file if it exists which can be used to diagnose problems.").action(printJuliaServerLog).command("close", "Close the worker for a given notebook. If it is currently running, it will not be interrupted.").arguments("<file:string>").option("-f, --force", "Force closing. This will terminate the worker if it is running.", {
    default: false
  }).action(async (options, file) => {
    await closeWorker(file, options.force);
  }).command("stop", "Stop the server").description("Send a message to the server that it should close all notebooks and exit. This will fail if any notebooks are not idle.").action(stopServer);
  return;
}
async function logStatus() {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    quarto.console.info("Julia control server is not running.");
    return;
  }
  const transportOptions = await readTransportFile(transportFile);
  const conn = await getReadyServerConnection(transportOptions, {});
  const successfullyConnected = typeof conn !== "string";
  if (successfullyConnected) {
    const status = await writeJuliaCommand(conn, {
      type: "status",
      content: {}
    }, transportOptions.key, {});
    Deno.stdout.writeSync(new TextEncoder().encode(status));
    conn.close();
  } else {
    quarto.console.info(`Found transport file but can't connect to control server.`);
  }
}
async function killJuliaServer() {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    quarto.console.info("Julia control server is not running.");
    return;
  }
  const transportOptions = await readTransportFile(transportFile);
  Deno.kill(transportOptions.pid, "SIGTERM");
  quarto.console.info("Sent SIGTERM to server process");
}
function printJuliaServerLog() {
  if (existsSync(juliaServerLogFile())) {
    Deno.stdout.writeSync(Deno.readFileSync(juliaServerLogFile()));
  } else {
    quarto.console.info("Server log file doesn't exist");
  }
  return;
}
async function connectAndWriteJuliaCommandToRunningServer(command) {
  const transportFile = juliaTransportFile();
  if (!existsSync(transportFile)) {
    throw new Error("Julia control server is not running.");
  }
  const transportOptions = await readTransportFile(transportFile);
  const conn = await getReadyServerConnection(transportOptions, {});
  const successfullyConnected = typeof conn !== "string";
  if (successfullyConnected) {
    const result = await writeJuliaCommand(conn, command, transportOptions.key, {});
    conn.close();
    return result;
  } else {
    throw new Error(`Found transport file but can't connect to control server.`);
  }
}
async function closeWorker(file, force) {
  const absfile = quarto.path.absolute(file);
  await connectAndWriteJuliaCommandToRunningServer({
    type: force ? "forceclose" : "close",
    content: {
      file: absfile
    }
  });
  quarto.console.info(`Worker ${force ? "force-" : ""}closed successfully.`);
}
async function stopServer() {
  const result = await connectAndWriteJuliaCommandToRunningServer({
    type: "stop",
    content: {}
  });
  quarto.console.info(result.message);
}
export {
  julia_engine_default as default,
  juliaEngineDiscovery,
  juliaServerLogFile,
  juliaTransportFile
};
