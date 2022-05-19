/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class PaymentMethodService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listPaymentMethodsForUser(): CancelablePromise<
    Array<{
      id?: string;
      method_name?: string;
      type?: string;
      state?: string;
      data?: {
        card_type?: string;
        last4?: string;
        email?: string;
      };
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/billing/payment_methods",
    });
  }
}
