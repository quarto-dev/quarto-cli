/*
* test-worker.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

if (import.meta.main) {
  let nThreads = navigator.hardwareConcurrency;
  if (Deno.args.length === 0) {
    console.log("Expected server URL");
    Deno.exit(1);
  }
  const serverUrl = Deno.args[0];
  if (Deno.args.length > 1) {
    nThreads = Number(Deno.args[1]) || nThreads;
  };
  console.log(`Will spawn ${nThreads} workers`);
  const workers: Worker[] = [];
  for (let i = 0; i < nThreads; ++i) {
    const worker = new Worker(new URL("./worker-worker.ts", import.meta.url).href, {type: "module"})
    worker.postMessage({ serverUrl, workerNumber: i + 1, maxWorkers: nThreads });
    workers.push(worker);
  }
}