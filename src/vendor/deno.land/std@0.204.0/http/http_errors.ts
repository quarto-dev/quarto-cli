// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

/** A collection of HTTP errors and utilities.
 *
 * The export {@linkcode errors} contains an individual class that extends
 * {@linkcode HttpError} which makes handling HTTP errors in a structured way.
 *
 * The function {@linkcode createHttpError} provides a way to create instances
 * of errors in a factory pattern.
 *
 * The function {@linkcode isHttpError} is a type guard that will narrow a value
 * to an `HttpError` instance.
 *
 * @example
 * ```ts
 * import { errors, isHttpError } from "https://deno.land/std@$STD_VERSION/http/http_errors.ts";
 *
 * try {
 *   throw new errors.NotFound();
 * } catch (e) {
 *   if (isHttpError(e)) {
 *     const response = new Response(e.message, { status: e.status });
 *   } else {
 *     throw e;
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * import { createHttpError } from "https://deno.land/std@$STD_VERSION/http/http_errors.ts";
 * import { Status } from "https://deno.land/std@$STD_VERSION/http/http_status.ts";
 *
 * try {
 *   throw createHttpError(
 *     Status.BadRequest,
 *     "The request was bad.",
 *     { expose: false }
 *   );
 * } catch (e) {
 *   // handle errors
 * }
 * ```
 *
 * @module
 */

import {
  type ErrorStatus,
  isClientErrorStatus,
  Status,
  STATUS_TEXT,
} from "./http_status.ts";

const ERROR_STATUS_MAP = {
  "BadRequest": 400,
  "Unauthorized": 401,
  "PaymentRequired": 402,
  "Forbidden": 403,
  "NotFound": 404,
  "MethodNotAllowed": 405,
  "NotAcceptable": 406,
  "ProxyAuthRequired": 407,
  "RequestTimeout": 408,
  "Conflict": 409,
  "Gone": 410,
  "LengthRequired": 411,
  "PreconditionFailed": 412,
  "RequestEntityTooLarge": 413,
  "RequestURITooLong": 414,
  "UnsupportedMediaType": 415,
  "RequestedRangeNotSatisfiable": 416,
  "ExpectationFailed": 417,
  "Teapot": 418,
  "MisdirectedRequest": 421,
  "UnprocessableEntity": 422,
  "Locked": 423,
  "FailedDependency": 424,
  "UpgradeRequired": 426,
  "PreconditionRequired": 428,
  "TooManyRequests": 429,
  "RequestHeaderFieldsTooLarge": 431,
  "UnavailableForLegalReasons": 451,
  "InternalServerError": 500,
  "NotImplemented": 501,
  "BadGateway": 502,
  "ServiceUnavailable": 503,
  "GatewayTimeout": 504,
  "HTTPVersionNotSupported": 505,
  "VariantAlsoNegotiates": 506,
  "InsufficientStorage": 507,
  "LoopDetected": 508,
  "NotExtended": 510,
  "NetworkAuthenticationRequired": 511,
} as const;

export type ErrorStatusKeys = keyof typeof ERROR_STATUS_MAP;

export interface HttpErrorOptions extends ErrorOptions {
  expose?: boolean;
  headers?: HeadersInit;
}

/** The base class that all derivative HTTP extend, providing a `status` and an
 * `expose` property. */
export class HttpError extends Error {
  #status: ErrorStatus = Status.InternalServerError;
  #expose: boolean;
  #headers?: Headers;
  constructor(
    message = "Http Error",
    options?: HttpErrorOptions,
  ) {
    super(message, options);
    this.#expose = options?.expose === undefined
      ? isClientErrorStatus(this.status)
      : options.expose;
    if (options?.headers) {
      this.#headers = new Headers(options.headers);
    }
  }
  /** A flag to indicate if the internals of the error, like the stack, should
   * be exposed to a client, or if they are "private" and should not be leaked.
   * By default, all client errors are `true` and all server errors are
   * `false`. */
  get expose(): boolean {
    return this.#expose;
  }
  /** The optional headers object that is set on the error. */
  get headers(): Headers | undefined {
    return this.#headers;
  }
  /** The error status that is set on the error. */
  get status(): ErrorStatus {
    return this.#status;
  }
}

function createHttpErrorConstructor(status: ErrorStatus): typeof HttpError {
  const name = `${Status[status]}Error`;
  const ErrorCtor = class extends HttpError {
    constructor(
      message = STATUS_TEXT[status],
      options?: HttpErrorOptions,
    ) {
      super(message, options);
      Object.defineProperty(this, "name", {
        configurable: true,
        enumerable: false,
        value: name,
        writable: true,
      });
    }

    override get status() {
      return status;
    }
  };
  return ErrorCtor;
}

/**
 * A namespace that contains each error constructor. Each error extends
 * `HTTPError` and provides `.status` and `.expose` properties, where the
 * `.status` will be an error `Status` value and `.expose` indicates if
 * information, like a stack trace, should be shared in the response.
 *
 * By default, `.expose` is set to false in server errors, and true for client
 * errors.
 *
 * @example
 * ```ts
 * import { errors } from "https://deno.land/std@$STD_VERSION/http/http_errors.ts";
 *
 * throw new errors.InternalServerError("Ooops!");
 * ```
 */
export const errors: Record<ErrorStatusKeys, typeof HttpError> = {} as Record<
  ErrorStatusKeys,
  typeof HttpError
>;

for (const [key, value] of Object.entries(ERROR_STATUS_MAP)) {
  errors[key as ErrorStatusKeys] = createHttpErrorConstructor(value);
}

/**
 * A factory function which provides a way to create errors. It takes up to 3
 * arguments, the error `Status`, an message, which defaults to the status text
 * and error options, which includes the `expose` property to set the `.expose`
 * value on the error.
 */
export function createHttpError(
  status: ErrorStatus = Status.InternalServerError,
  message?: string,
  options?: HttpErrorOptions,
): HttpError {
  return new errors[Status[status] as ErrorStatusKeys](message, options);
}

/** A type guard that determines if the value is an HttpError or not. */
export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}
