/*
* worker-manager.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import { expandGlob } from "fs/expand_glob.ts";
import { relative } from "path/mod.ts";

type TestResult = {
  name: string;
  status: "pass" | "fail";
  output: string;
};

type State = {
  outstandingTests: string[];
  waitingTests: string[];
  results: Record<string, TestResult>
};

let globalState: State = {
  outstandingTests: [],
  waitingTests: [],
  results: {},
};

async function findAllTests(): Promise<string[]> {
  const tests = await expandGlob("**/{*_,*.,}test.{js,mjs,ts,mts,jsx,tsx}");
  const result: string[] = [];
  for await (const test of tests) {
    let path = relative(Deno.cwd(), test.path);
    if (path === "smoke/smoke-all.test.ts" || 
        path.match("smoke/smoke-all/.*.js")) {
      continue;
    }
    result.push(path);
  }
  // smoke-all tests
  const smokeAllTests = await expandGlob("docs/smoke-all/**/*.{md,qmd,ipynb}");
  for await (const test of smokeAllTests) {
    result.push(relative(Deno.cwd(), test.path));
  }

  return result;
}

type ReqHandler = (req: Request) => Promise<Response>;
const handlePost = (fun: ReqHandler): ReqHandler => async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Bad request", { status: 400 });
  }
  return fun(req);
};

const allTests: string[] = await findAllTests();

function startRun() {
  globalState = { 
    outstandingTests: allTests.slice(), 
    waitingTests: [], 
    results: {} 
  };
  console.log(`Starting run with ${globalState.outstandingTests.length} tests`);
}

const dispatch: Record<string, ReqHandler> = {
  "/commit": async (req: Request) => {
    const cmd = new Deno.Command("git", {
      args: ["--no-pager", "show", "--oneline"]
    });
    const output = cmd.outputSync();
    const text = new TextDecoder().decode(output.stdout);
    return new Response(text.split(" ")[0] || "unknown");
  },
  "/start-run": handlePost(async (req: Request) => {
    startRun();
    return new Response(`OK, ${globalState.outstandingTests.length} tests`);
  }),
  "/get-test": handlePost(async (req) => {
    if (globalState.outstandingTests.length === 0) {
      return new Response(undefined, { status: 204 });
    }
    const test = globalState.outstandingTests.shift()!;
    globalState.waitingTests.push(test);
    console.log(`sending ${test}`);
    return new Response(test);
  }),
  "/report-test": handlePost(async (req) => {
    const json = await req.json();
    if (json.name === undefined) {
      return new Response("Bad request, no name", { status: 400 });
    }
    const index = globalState.waitingTests.indexOf(json.name);
    if (index === -1) {
      return new Response(`Bad request: ${json.name} not needed`, { status: 400 });
    }
    globalState.waitingTests.splice(index, 1);
    // TODO validate json
    globalState.results[json.name] = json;
    console.log(`report  ${json.status.toLocaleUpperCase()} ${json.name}`);
    return new Response("ok");
  }),
  "/get-results": handlePost(async (req) => {
    return new Response(JSON.stringify(globalState.results));
  }),
}

if (import.meta.main) {
  startRun();
  Deno.serve((req) => {
    const url = new URL(req.url, "http://localhost:8000")
    const handler = dispatch[url.pathname];
    if (handler) {
      return handler(req);
    } else {
      return new Response("Bad request", { status: 400 });
    }
  });
}