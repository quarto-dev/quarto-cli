/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class TicketService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any error
   * @throws ApiError
   */
  public createTicket({
    clientId,
  }: {
    clientId: string,
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: 'POST',
      url: '/oauth/tickets',
      query: {
        'client_id': clientId,
      },
    });
  }

  /**
   * @returns any ok
   * @throws ApiError
   */
  public showTicket({
    ticketId,
  }: {
    ticketId: string,
  }): CancelablePromise<{
    id?: string;
    client_id?: string;
    authorized?: boolean;
    created_at?: string;
  }> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/oauth/tickets/{ticket_id}',
      path: {
        'ticket_id': ticketId,
      },
    });
  }

}