// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2017 Calvin Metcalf. All rights reserved. MIT license.

import { publicEncrypt } from "./public_encrypt.js";
import { privateDecrypt } from "./private_decrypt.js";

export { privateDecrypt, publicEncrypt };

export function privateEncrypt(key, buf) {
  return publicEncrypt(key, buf, true);
}

export function publicDecrypt(key, buf) {
  return privateDecrypt(key, buf, true);
}
