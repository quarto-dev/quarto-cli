// paths.ts
var mainPath = "";
function setMainPath(path) {
  mainPath = path;
}
function getLocalPath(filename) {
  const result = new URL(mainPath);
  result.pathname = [...result.pathname.split("/").slice(0, -1), filename].join(
    "/"
  );
  return result.toString();
}

// ../external/colors.ts
var Deno2;
try {
  Deno2 = globalThis.Deno;
} catch (_e) {
}
var noColor = typeof (Deno2 && Deno2.noColor) === "boolean" ? Deno2.noColor : true;
var ANSI_PATTERN = new RegExp(
  [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
  ].join("|"),
  "g"
);

// ../error.ts
var InternalError = class extends Error {
  constructor(message, printName = true, printStack = true) {
    super(message);
    this.name = "Internal Error";
    this.printName = printName;
    this.printStack = printStack;
  }
};

// web-worker-manager.ts
function clientStubs(calls, worker) {
  let callId = 0;
  const nextId = () => callId++;
  const result = {};
  const promises = {};
  for (const callName of calls) {
    result[callName] = (...args) => {
      const thisId = nextId();
      worker.postMessage({
        callName,
        args: JSON.parse(JSON.stringify(args)),
        id: thisId
      });
      return new Promise((resolve, reject) => {
        promises[thisId] = { resolve, reject };
      });
    };
  }
  worker.onmessage = function(e) {
    const { result: result2, exception, id } = e.data;
    if (promises[id] === void 0) {
      throw new InternalError(`bad call id ${id} in web worker RPC`);
    }
    const { resolve, reject } = promises[id];
    delete promises[id];
    if (result2) {
      resolve(result2);
    } else if (exception) {
      reject(exception);
    }
  };
  return result;
}

// ide-main.ts
var stubs;
function ensureStubs(path) {
  if (stubs) {
    return;
  }
  setMainPath(path);
  const worker = new Worker(getLocalPath("web-worker.js"));
  stubs = clientStubs(["getCompletions", "getLint"], worker);
}
var QuartoYamlEditorTools = {
  getCompletions: async function(context, path) {
    ensureStubs(path);
    return await stubs["getCompletions"](context, path);
  },
  getLint: async function(context, path) {
    ensureStubs(path);
    return await stubs["getLint"](context, path);
  }
};
export {
  QuartoYamlEditorTools
};
