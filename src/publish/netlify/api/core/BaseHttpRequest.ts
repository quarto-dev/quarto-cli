// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiRequestOptions } from "./ApiRequestOptions.ts";
import type { CancelablePromise } from "./CancelablePromise.ts";
import type { OpenAPIConfig } from "./OpenAPI.ts";

export abstract class BaseHttpRequest {
  constructor(public readonly config: OpenAPIConfig) {}

  public abstract request<T>(options: ApiRequestOptions): CancelablePromise<T>;
}
