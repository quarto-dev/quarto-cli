/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class HookTypeService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listHookTypes(): CancelablePromise<
    Array<{
      name?: string;
      events?: Array<string>;
      fields?: Array<any>;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/hooks/types",
    });
  }
}
