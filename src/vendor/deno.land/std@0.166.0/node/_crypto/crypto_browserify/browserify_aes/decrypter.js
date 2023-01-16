// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright 2014-2017 browserify-aes contributors. All rights reserved. MIT license.
// Copyright 2013 Maxwell Krohn. All rights reserved. MIT license.
// Copyright 2009-2013 Jeff Mott. All rights reserved. MIT license.

// deno-lint-ignore-file no-var

import { Buffer } from "../../../buffer.ts";
import AuthCipher from "./auth_cipher.js";
import StreamCipher from "./stream_cipher.js";
import Transform from "../cipher_base.js";
import * as aes from "./aes.js";
import ebtk from "../evp_bytes_to_key.ts";
import { MODES } from "./modes/mod.js";

function Decipher(mode, key, iv) {
  Transform.call(this);

  this._cache = new Splitter();
  this._last = void 0;
  this._cipher = new aes.AES(key);
  this._prev = Buffer.from(iv);
  this._mode = mode;
  this._autopadding = true;
}

Decipher.prototype = Object.create(Transform.prototype, {
  constructor: {
    value: Decipher,
    enumerable: false,
    writable: true,
    configurable: true,
  },
});

Decipher.prototype._update = function (data) {
  this._cache.add(data);
  var chunk;
  var thing;
  var out = [];
  while ((chunk = this._cache.get(this._autopadding))) {
    thing = this._mode.decrypt(this, chunk);
    out.push(thing);
  }
  return Buffer.concat(out);
};

Decipher.prototype._final = function () {
  var chunk = this._cache.flush();
  if (this._autopadding) {
    return unpad(this._mode.decrypt(this, chunk));
  } else if (chunk) {
    throw new Error("data not multiple of block length");
  }
};

Decipher.prototype.setAutoPadding = function (setTo) {
  this._autopadding = !!setTo;
  return this;
};

function Splitter() {
  this.cache = Buffer.allocUnsafe(0);
}

Splitter.prototype.add = function (data) {
  this.cache = Buffer.concat([this.cache, data]);
};

Splitter.prototype.get = function (autoPadding) {
  var out;
  if (autoPadding) {
    if (this.cache.length > 16) {
      out = this.cache.slice(0, 16);
      this.cache = this.cache.slice(16);
      return out;
    }
  } else {
    if (this.cache.length >= 16) {
      out = this.cache.slice(0, 16);
      this.cache = this.cache.slice(16);
      return out;
    }
  }

  return null;
};

Splitter.prototype.flush = function () {
  if (this.cache.length) return this.cache;
};

function unpad(last) {
  var padded = last[15];
  if (padded < 1 || padded > 16) {
    throw new Error("unable to decrypt data");
  }
  var i = -1;
  while (++i < padded) {
    if (last[i + (16 - padded)] !== padded) {
      throw new Error("unable to decrypt data");
    }
  }
  if (padded === 16) return;

  return last.slice(0, 16 - padded);
}

export function createDecipheriv(suite, password, iv) {
  var config = MODES[suite.toLowerCase()];
  if (!config) throw new TypeError("invalid suite type");

  if (typeof iv === "string") iv = Buffer.from(iv);
  if (config.mode !== "GCM" && iv.length !== config.iv) {
    throw new TypeError("invalid iv length " + iv.length);
  }

  if (typeof password === "string") password = Buffer.from(password);
  if (password.length !== config.key / 8) {
    throw new TypeError("invalid key length " + password.length);
  }

  if (config.type === "stream") {
    return new StreamCipher(config.module, password, iv, true);
  } else if (config.type === "auth") {
    return new AuthCipher(config.module, password, iv, true);
  }

  return new Decipher(config.module, password, iv);
}

export function createDecipher(suite, password) {
  var config = MODES[suite.toLowerCase()];
  if (!config) throw new TypeError("invalid suite type");

  var keys = ebtk(password, false, config.key, config.iv);
  return createDecipheriv(suite, keys.key, keys.iv);
}
