/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AssetPublicSignatureService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteAssetPublicSignature({
    siteId,
    assetId,
  }: {
    siteId: string;
    assetId: string;
  }): CancelablePromise<{
    url?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/assets/{asset_id}/public_signature",
      path: {
        "site_id": siteId,
        "asset_id": assetId,
      },
    });
  }
}
