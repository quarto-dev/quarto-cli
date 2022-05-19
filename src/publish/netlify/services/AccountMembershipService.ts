/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AccountMembershipService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listAccountsForUser(): CancelablePromise<
    Array<{
      id?: string;
      name?: string;
      slug?: string;
      type?: string;
      capabilities?: {
        sites?: {
          included?: number;
          used?: number;
        };
        collaborators?: {
          included?: number;
          used?: number;
        };
      };
      billing_name?: string;
      billing_email?: string;
      billing_details?: string;
      billing_period?: string;
      payment_method_id?: string;
      type_name?: string;
      type_id?: string;
      owner_ids?: Array<string>;
      roles_allowed?: Array<string>;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/accounts",
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createAccount({
    accountSetup,
  }: {
    accountSetup: {
      name: string;
      type_id: string;
      payment_method_id?: string;
      period?: "monthly" | "yearly";
      extra_seats_block?: number;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/accounts",
      body: accountSetup,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getAccount({
    accountId,
  }: {
    accountId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      name?: string;
      slug?: string;
      type?: string;
      capabilities?: {
        sites?: {
          included?: number;
          used?: number;
        };
        collaborators?: {
          included?: number;
          used?: number;
        };
      };
      billing_name?: string;
      billing_email?: string;
      billing_details?: string;
      billing_period?: string;
      payment_method_id?: string;
      type_name?: string;
      type_id?: string;
      owner_ids?: Array<string>;
      roles_allowed?: Array<string>;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/accounts/{account_id}",
      path: {
        "account_id": accountId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public updateAccount({
    accountId,
    accountUpdateSetup,
  }: {
    accountId: string;
    accountUpdateSetup?: {
      name?: string;
      slug?: string;
      type_id?: string;
      extra_seats_block?: number;
      billing_name?: string;
      billing_email?: string;
      billing_details?: string;
    };
  }): CancelablePromise<{
    id?: string;
    name?: string;
    slug?: string;
    type?: string;
    capabilities?: {
      sites?: {
        included?: number;
        used?: number;
      };
      collaborators?: {
        included?: number;
        used?: number;
      };
    };
    billing_name?: string;
    billing_email?: string;
    billing_details?: string;
    billing_period?: string;
    payment_method_id?: string;
    type_name?: string;
    type_id?: string;
    owner_ids?: Array<string>;
    roles_allowed?: Array<string>;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/accounts/{account_id}",
      path: {
        "account_id": accountId,
      },
      body: accountUpdateSetup,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public cancelAccount({
    accountId,
  }: {
    accountId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/accounts/{account_id}",
      path: {
        "account_id": accountId,
      },
    });
  }
}
