/*
* web-worker.ts
*
* Copyright (C) 2022 by RStudio, PBC
*
*/

import { workerCallback } from "./web-worker-manager.ts";

import { getCompletions, getLint } from "./yaml-intelligence.ts";

onmessage = workerCallback({
  getCompletions,
  getLint,
});
