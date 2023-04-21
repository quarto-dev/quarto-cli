// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent, Inc. and Node.js contributors. All rights reserved. MIT license.

import { notImplemented } from "../../_utils.ts";
import { Buffer } from "../../buffer.ts";
import { BinaryLike } from "./types.ts";

export class Certificate {
  static Certificate = Certificate;
  static exportChallenge(_spkac: BinaryLike, _encoding?: string): Buffer {
    notImplemented("crypto.Certificate.exportChallenge");
  }

  static exportPublicKey(_spkac: BinaryLike, _encoding?: string): Buffer {
    notImplemented("crypto.Certificate.exportPublicKey");
  }

  static verifySpkac(_spkac: BinaryLike, _encoding?: string): boolean {
    notImplemented("crypto.Certificate.verifySpkac");
  }
}

export default Certificate;
