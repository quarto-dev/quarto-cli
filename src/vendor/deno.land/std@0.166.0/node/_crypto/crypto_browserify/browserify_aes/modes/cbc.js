// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2014-2017 browserify-aes contributors. All rights reserved. MIT license.
// Copyright 2013 Maxwell Krohn. All rights reserved. MIT license.
// Copyright 2009-2013 Jeff Mott. All rights reserved. MIT license.

import { xor } from "../xor.ts";

export const encrypt = function (self, block) {
  const data = xor(block, self._prev);

  self._prev = self._cipher.encryptBlock(data);
  return self._prev;
};

export const decrypt = function (self, block) {
  const pad = self._prev;

  self._prev = block;
  const out = self._cipher.decryptBlock(block);

  return xor(out, pad);
};
