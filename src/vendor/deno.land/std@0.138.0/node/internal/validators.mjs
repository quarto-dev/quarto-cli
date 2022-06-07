// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Joyent and Node contributors. All rights reserved. MIT license.

import { codes } from "./error_codes.ts";
import { hideStackFrames } from "./hide_stack_frames.ts";
import { isArrayBufferView } from "./util/types.ts";
import { normalizeEncoding } from "./normalize_encoding.mjs";

/**
 * @param {number} value
 * @returns {boolean}
 */
function isInt32(value) {
  return value === (value | 0);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isUint32(value) {
  return value === (value >>> 0);
}

const octalReg = /^[0-7]+$/;
const modeDesc = "must be a 32-bit unsigned integer or an octal string";

/**
 * Parse and validate values that will be converted into mode_t (the S_*
 * constants). Only valid numbers and octal strings are allowed. They could be
 * converted to 32-bit unsigned integers or non-negative signed integers in the
 * C++ land, but any value higher than 0o777 will result in platform-specific
 * behaviors.
 *
 * @param {*} value Values to be validated
 * @param {string} name Name of the argument
 * @param {number} [def] If specified, will be returned for invalid values
 * @returns {number}
 */
function parseFileMode(value, name, def) {
  value ??= def;
  if (typeof value === "string") {
    if (!octalReg.test(value)) {
      throw new codes.ERR_INVALID_ARG_VALUE(name, value, modeDesc);
    }
    value = Number.parseInt(value, 8);
  }

  validateInt32(value, name, 0, 2 ** 32 - 1);
  return value;
}

const validateBuffer = hideStackFrames((buffer, name = "buffer") => {
  if (!isArrayBufferView(buffer)) {
    throw new codes.ERR_INVALID_ARG_TYPE(
      name,
      ["Buffer", "TypedArray", "DataView"],
      buffer,
    );
  }
});

const validateInteger = hideStackFrames(
  (
    value,
    name,
    min = Number.MIN_SAFE_INTEGER,
    max = Number.MAX_SAFE_INTEGER,
  ) => {
    if (typeof value !== "number") {
      throw new codes.ERR_INVALID_ARG_TYPE(name, "number", value);
    }
    if (!Number.isInteger(value)) {
      throw new codes.ERR_OUT_OF_RANGE(name, "an integer", value);
    }
    if (value < min || value > max) {
      throw new codes.ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
    }
  },
);

/**
 * @param {unknown} value
 * @param {string} name
 * @param {{
 *   allowArray?: boolean,
 *   allowFunction?: boolean,
 *   nullable?: boolean
 * }} [options]
 */
const validateObject = hideStackFrames((value, name, options) => {
  const useDefaultOptions = options == null;
  const allowArray = useDefaultOptions ? false : options.allowArray;
  const allowFunction = useDefaultOptions ? false : options.allowFunction;
  const nullable = useDefaultOptions ? false : options.nullable;
  if (
    (!nullable && value === null) ||
    (!allowArray && Array.isArray(value)) ||
    (typeof value !== "object" && (
      !allowFunction || typeof value !== "function"
    ))
  ) {
    throw new codes.ERR_INVALID_ARG_TYPE(name, "Object", value);
  }
});

const validateInt32 = hideStackFrames(
  (value, name, min = -2147483648, max = 2147483647) => {
    // The defaults for min and max correspond to the limits of 32-bit integers.
    if (!isInt32(value)) {
      if (typeof value !== "number") {
        throw new codes.ERR_INVALID_ARG_TYPE(name, "number", value);
      }

      if (!Number.isInteger(value)) {
        throw new codes.ERR_OUT_OF_RANGE(name, "an integer", value);
      }

      throw new codes.ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
    }

    if (value < min || value > max) {
      throw new codes.ERR_OUT_OF_RANGE(name, `>= ${min} && <= ${max}`, value);
    }
  },
);

const validateUint32 = hideStackFrames(
  (value, name, positive) => {
    if (!isUint32(value)) {
      if (typeof value !== "number") {
        throw new codes.ERR_INVALID_ARG_TYPE(name, "number", value);
      }
      if (!Number.isInteger(value)) {
        throw new codes.ERR_OUT_OF_RANGE(name, "an integer", value);
      }
      const min = positive ? 1 : 0;
      // 2 ** 32 === 4294967296
      throw new codes.ERR_OUT_OF_RANGE(
        name,
        `>= ${min} && < 4294967296`,
        value,
      );
    }
    if (positive && value === 0) {
      throw new codes.ERR_OUT_OF_RANGE(name, ">= 1 && < 4294967296", value);
    }
  },
);

/**
 * @param {unknown} value
 * @param {string} name
 */
function validateString(value, name) {
  if (typeof value !== "string") {
    throw new codes.ERR_INVALID_ARG_TYPE(name, "string", value);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function validateNumber(value, name) {
  if (typeof value !== "number") {
    throw new codes.ERR_INVALID_ARG_TYPE(name, "number", value);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 */
function validateBoolean(value, name) {
  if (typeof value !== "boolean") {
    throw new codes.ERR_INVALID_ARG_TYPE(name, "boolean", value);
  }
}

/**
 * @param {unknown} value
 * @param {string} name
 * @param {unknown[]} oneOf
 */
const validateOneOf = hideStackFrames(
  (value, name, oneOf) => {
    if (!Array.prototype.includes.call(oneOf, value)) {
      const allowed = Array.prototype.join.call(
        Array.prototype.map.call(
          oneOf,
          (v) => (typeof v === "string" ? `'${v}'` : String(v)),
        ),
        ", ",
      );
      const reason = "must be one of: " + allowed;

      throw new codes.ERR_INVALID_ARG_VALUE(name, value, reason);
    }
  },
);

export function validateEncoding(data, encoding) {
  const normalizedEncoding = normalizeEncoding(encoding);
  const length = data.length;

  if (normalizedEncoding === "hex" && length % 2 !== 0) {
    throw new codes.ERR_INVALID_ARG_VALUE(
      "encoding",
      encoding,
      `is invalid for data of length ${length}`,
    );
  }
}

// Check that the port number is not NaN when coerced to a number,
// is an integer and that it falls within the legal range of port numbers.
/**
 * @param {string} name
 * @returns {number}
 */
function validatePort(port, name = "Port", allowZero = true) {
  if (
    (typeof port !== "number" && typeof port !== "string") ||
    (typeof port === "string" &&
      String.prototype.trim.call(port).length === 0) ||
    +port !== (+port >>> 0) ||
    port > 0xFFFF ||
    (port === 0 && !allowZero)
  ) {
    throw new codes.ERR_SOCKET_BAD_PORT(name, port, allowZero);
  }

  return port;
}

/**
 * @param {unknown} callback
 */
const validateCallback = hideStackFrames((callback) => {
  if (typeof callback !== "function") {
    throw new codes.ERR_INVALID_CALLBACK(callback);
  }
});

/**
 * @param {unknown} signal
 * @param {string} name
 */
const validateAbortSignal = hideStackFrames(
  (signal, name) => {
    if (
      signal !== undefined &&
      (signal === null ||
        typeof signal !== "object" ||
        !("aborted" in signal))
    ) {
      throw new codes.ERR_INVALID_ARG_TYPE(name, "AbortSignal", signal);
    }
  },
);

/**
 * @param {unknown} value
 * @param {string} name
 */
const validateFunction = hideStackFrames(
  (value, name) => {
    if (typeof value !== "function") {
      throw new codes.ERR_INVALID_ARG_TYPE(name, "Function", value);
    }
  },
);

/**
 * @param {unknown} value
 * @param {string} name
 */
const validateArray = hideStackFrames(
  (value, name, minLength = 0) => {
    if (!Array.isArray(value)) {
      throw new codes.ERR_INVALID_ARG_TYPE(name, "Array", value);
    }
    if (value.length < minLength) {
      const reason = `must be longer than ${minLength}`;
      throw new codes.ERR_INVALID_ARG_VALUE(name, value, reason);
    }
  },
);

export default {
  isInt32,
  isUint32,
  parseFileMode,
  validateAbortSignal,
  validateArray,
  validateBoolean,
  validateBuffer,
  validateCallback,
  validateFunction,
  validateInt32,
  validateInteger,
  validateNumber,
  validateObject,
  validateOneOf,
  validatePort,
  validateString,
  validateUint32,
};
export {
  isInt32,
  isUint32,
  parseFileMode,
  validateAbortSignal,
  validateArray,
  validateBoolean,
  validateBuffer,
  validateCallback,
  validateFunction,
  validateInt32,
  validateInteger,
  validateNumber,
  validateObject,
  validateOneOf,
  validatePort,
  validateString,
  validateUint32,
};
