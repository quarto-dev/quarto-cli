/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AuditLogService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listAccountAuditEvents({
    accountId,
    query,
    logType,
    page,
    perPage,
  }: {
    accountId: string;
    query?: string;
    logType?: string;
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      account_id?: string;
      payload?: Record<string, any>;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/accounts/{account_id}/audit",
      path: {
        "account_id": accountId,
      },
      query: {
        "query": query,
        "log_type": logType,
        "page": page,
        "per_page": perPage,
      },
    });
  }
}
