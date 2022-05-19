/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class UserService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getCurrentUser(): CancelablePromise<
    Array<{
      id?: string;
      uid?: string;
      full_name?: string;
      avatar_url?: string;
      email?: string;
      affiliate_id?: string;
      site_count?: number;
      created_at?: string;
      last_login?: string;
      login_providers?: Array<string>;
      onboarding_progress?: {
        slides?: string;
      };
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/user",
    });
  }
}
