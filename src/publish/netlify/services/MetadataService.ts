/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class MetadataService {

  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteMetadata({
    siteId,
  }: {
    siteId: string,
  }): CancelablePromise<any> {
    return this.httpRequest.request({
      method: 'GET',
      url: '/sites/{site_id}/metadata',
      path: {
        'site_id': siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateSiteMetadata({
    siteId,
    metadata,
  }: {
    siteId: string,
    metadata: any,
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: 'PUT',
      url: '/sites/{site_id}/metadata',
      path: {
        'site_id': siteId,
      },
      body: metadata,
    });
  }

}