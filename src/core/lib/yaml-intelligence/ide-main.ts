import { getLocalPath, setMainPath } from "./paths.ts";
import { Callable, clientStubs } from "./web-worker-manager.ts";
import { YamlIntelligenceContext } from "./types.ts";

let stubs: Record<string, Callable> | undefined;

function ensureStubs(path: string) {
  if (stubs) {
    return;
  }
  setMainPath(path);

  const worker = new Worker(getLocalPath("web-worker.js"));
  stubs = clientStubs(["getCompletions", "getLint"], worker);
}

export const QuartoYamlEditorTools = {
  // helpers to facilitate repro'ing in the browser
  // getAutomation: function (
  //   params: { context: YamlIntelligenceContext; kind: AutomationKind },
  // ) {
  //   const {
  //     context,
  //     kind,
  //   } = params;
  //   return getAutomation(kind, context);
  // },
  // exportSmokeTest,

  // entry points required by the IDE
  getCompletions: async function (
    context: YamlIntelligenceContext,
    path: string,
  ) {
    ensureStubs(path);
    return await stubs!["getCompletions"](context, path);
  },

  getLint: async function (
    context: YamlIntelligenceContext,
    path: string,
  ) {
    ensureStubs(path);
    return await stubs!["getLint"](context, path);
  },
};
