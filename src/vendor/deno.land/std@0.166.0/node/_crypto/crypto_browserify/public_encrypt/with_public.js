// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2017 Calvin Metcalf. All rights reserved. MIT license.

import { BN } from "../bn.js/bn.js";
import { Buffer } from "../../../buffer.ts";

export function withPublic(paddedMsg, key) {
  return Buffer.from(
    paddedMsg
      .toRed(BN.mont(key.modulus))
      .redPow(new BN(key.publicExponent))
      .fromRed()
      .toArray(),
  );
}
