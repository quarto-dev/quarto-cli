/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class SniCertificateService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public provisionSiteTlsCertificate({
    siteId,
    certificate,
    key,
    caCertificates,
  }: {
    siteId: string;
    certificate?: string;
    key?: string;
    caCertificates?: string;
  }): CancelablePromise<{
    state?: string;
    domains?: Array<string>;
    created_at?: string;
    updated_at?: string;
    expires_at?: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/ssl",
      path: {
        "site_id": siteId,
      },
      query: {
        "certificate": certificate,
        "key": key,
        "ca_certificates": caCertificates,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public showSiteTlsCertificate({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<{
    state?: string;
    domains?: Array<string>;
    created_at?: string;
    updated_at?: string;
    expires_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/ssl",
      path: {
        "site_id": siteId,
      },
    });
  }
}
