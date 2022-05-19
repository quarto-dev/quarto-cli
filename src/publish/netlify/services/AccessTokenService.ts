/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AccessTokenService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any error
   * @throws ApiError
   */
  public exchangeTicket({
    ticketId,
  }: {
    ticketId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/oauth/tickets/{ticket_id}/exchange",
      path: {
        "ticket_id": ticketId,
      },
    });
  }
}
