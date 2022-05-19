/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AccountTypeService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listAccountTypesForUser(): CancelablePromise<
    Array<{
      id?: string;
      name?: string;
      description?: string;
      capabilities?: any;
      monthly_dollar_price?: number;
      yearly_dollar_price?: number;
      monthly_seats_addon_dollar_price?: number;
      yearly_seats_addon_dollar_price?: number;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/accounts/types",
    });
  }
}
