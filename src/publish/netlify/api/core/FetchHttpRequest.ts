// deno-lint-ignore-file
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiRequestOptions } from "./ApiRequestOptions.ts";
import { BaseHttpRequest } from "./BaseHttpRequest.ts";
import type { CancelablePromise } from "./CancelablePromise.ts";
import type { OpenAPIConfig } from "./OpenAPI.ts";
import { request as __request } from "./request.ts";

export class FetchHttpRequest extends BaseHttpRequest {
  constructor(config: OpenAPIConfig) {
    super(config);
  }

  /**
   * Request method
   * @param options The request options from the service
   * @returns CancelablePromise<T>
   * @throws ApiError
   */
  public override request<T>(options: ApiRequestOptions): CancelablePromise<T> {
    return __request(this.config, options);
  }
}
