/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class BuildHookService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteBuildHooks({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      title?: string;
      branch?: string;
      url?: string;
      site_id?: string;
      created_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/build_hooks",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSiteBuildHook({
    siteId,
    buildHook,
  }: {
    siteId: string;
    buildHook: {
      title?: string;
      branch?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/build_hooks",
      path: {
        "site_id": siteId,
      },
      body: buildHook,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteBuildHook({
    siteId,
    id,
  }: {
    siteId: string;
    id: string;
  }): CancelablePromise<{
    id?: string;
    title?: string;
    branch?: string;
    url?: string;
    site_id?: string;
    created_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/build_hooks/{id}",
      path: {
        "site_id": siteId,
        "id": id,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateSiteBuildHook({
    siteId,
    id,
    buildHook,
  }: {
    siteId: string;
    id: string;
    buildHook: {
      title?: string;
      branch?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/build_hooks/{id}",
      path: {
        "site_id": siteId,
        "id": id,
      },
      body: buildHook,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteSiteBuildHook({
    siteId,
    id,
  }: {
    siteId: string;
    id: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/sites/{site_id}/build_hooks/{id}",
      path: {
        "site_id": siteId,
        "id": id,
      },
    });
  }
}
