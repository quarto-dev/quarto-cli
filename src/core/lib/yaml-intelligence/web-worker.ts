/*
* web-worker.ts
*
* Copyright (C) 2022-2023 Posit, PBC
*
*/

import { workerCallback } from "./web-worker-manager.ts";

import { getCompletions, getLint } from "./yaml-intelligence.ts";

onmessage = workerCallback({
  getCompletions,
  getLint,
});
