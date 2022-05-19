/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class MemberService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listMembersForAccount({
    accountSlug,
  }: {
    accountSlug: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      full_name?: string;
      email?: string;
      avatar?: string;
      role?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/{account_slug}/members",
      path: {
        "account_slug": accountSlug,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public addMemberToAccount({
    accountSlug,
    email,
    role,
  }: {
    accountSlug: string;
    email: string;
    role?: "Owner" | "Collaborator" | "Controller";
  }): CancelablePromise<
    Array<{
      id?: string;
      full_name?: string;
      email?: string;
      avatar?: string;
      role?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "POST",
      url: "/{account_slug}/members",
      path: {
        "account_slug": accountSlug,
      },
      query: {
        "role": role,
        "email": email,
      },
    });
  }
}
