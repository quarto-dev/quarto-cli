/*
* worker-worker.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

let serverUrl = "http://localhost:8000";
let workerNumber = 1;
let maxWorkers = 1;
let errors: string[] = [];

function message(str: string, ...args: unknown[]) {
  console.log(`Worker ${" ".repeat(String(maxWorkers).length - String(workerNumber).length)}${workerNumber}: ${str}`, ...args);
}

async function runOneTest() {
  const response = await fetch(`${serverUrl}get-test`, { method: "POST" });
  if (response.status === 204) {
    message("No more tests. Stopping.");
    return false;
  }
  if (response.status !== 200) {
    message("Error in request response, stopping. Error follows:\n", response);
    return false;
  }
  const test = await response.text();
  message(`Will run ${test}`);
  const cmd = new Deno.Command("./run-fast-tests.sh", {
    args: [test],
  });
  const result = cmd.outputSync();
  const output = new TextDecoder().decode(result.stdout)
  if (result.code !== 0) {
    errors.push(test);
  }
  const reportResponse = await fetch(`${serverUrl}report-test`, { 
    method: "POST", 
    body: JSON.stringify({ 
      name: test, 
      runner: Deno.hostname(),
      status: result.code === 0 ? "pass" : "fail",
      output,
    })
  });
  if (reportResponse.status !== 200) {
    message("Error in report response, stopping. Error follows:\n", response);
    return false;
  }
  return true;
}

(self as any).onmessage = async (evt: any) => {
  if (evt.data.serverUrl) {
    serverUrl = evt.data.serverUrl;
    workerNumber = evt.data.workerNumber;
    maxWorkers = evt.data.maxWorkers;
    while (await runOneTest()) {
      // do nothing
    }
    for (const error of errors) {
      message(`Failed test: ${error}`)
    }
    self.close();
  }
};

