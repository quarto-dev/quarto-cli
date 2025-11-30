// src/core/api/crypto.ts

import { globalRegistry } from "./registry.ts";
import type { CryptoNamespace } from "./types.ts";

// Import implementation
import { md5HashSync } from "../hash.ts";

// Register crypto namespace
globalRegistry.register("crypto", (): CryptoNamespace => {
  return {
    md5Hash: md5HashSync,
  };
});
