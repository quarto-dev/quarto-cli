(() => {
  // yaml-intelligence.js
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
        throw new Error(`Internal Error: bad call id ${id} in web worker RPC`);
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

  // automation.js
  window.QuartoYamlEditorTools = QuartoYamlEditorTools;
})();
