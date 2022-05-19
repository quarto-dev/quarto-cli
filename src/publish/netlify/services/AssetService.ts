/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class AssetService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteAssets({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      site_id?: string;
      creator_id?: string;
      name?: string;
      state?: string;
      content_type?: string;
      url?: string;
      key?: string;
      visibility?: string;
      size?: number;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/assets",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSiteAsset({
    siteId,
    name,
    size,
    contentType,
    visibility,
  }: {
    siteId: string;
    name: string;
    size: number;
    contentType: string;
    visibility?: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/assets",
      path: {
        "site_id": siteId,
      },
      query: {
        "name": name,
        "size": size,
        "content_type": contentType,
        "visibility": visibility,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteAssetInfo({
    siteId,
    assetId,
  }: {
    siteId: string;
    assetId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    creator_id?: string;
    name?: string;
    state?: string;
    content_type?: string;
    url?: string;
    key?: string;
    visibility?: string;
    size?: number;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/assets/{asset_id}",
      path: {
        "site_id": siteId,
        "asset_id": assetId,
      },
    });
  }

  /**
   * @returns any Updated
   * @throws ApiError
   */
  public updateSiteAsset({
    siteId,
    assetId,
    state,
  }: {
    siteId: string;
    assetId: string;
    state: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    creator_id?: string;
    name?: string;
    state?: string;
    content_type?: string;
    url?: string;
    key?: string;
    visibility?: string;
    size?: number;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/assets/{asset_id}",
      path: {
        "site_id": siteId,
        "asset_id": assetId,
      },
      query: {
        "state": state,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteSiteAsset({
    siteId,
    assetId,
  }: {
    siteId: string;
    assetId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/sites/{site_id}/assets/{asset_id}",
      path: {
        "site_id": siteId,
        "asset_id": assetId,
      },
    });
  }
}
