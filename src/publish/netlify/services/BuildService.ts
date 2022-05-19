/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class BuildService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteBuilds({
    siteId,
    page,
    perPage,
  }: {
    siteId: string;
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      deploy_id?: string;
      sha?: string;
      done?: boolean;
      error?: string;
      created_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/builds",
      path: {
        "site_id": siteId,
      },
      query: {
        "page": page,
        "per_page": perPage,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public createSiteBuild({
    siteId,
    build,
  }: {
    siteId: string;
    build?: {
      image?: string;
    };
  }): CancelablePromise<{
    id?: string;
    deploy_id?: string;
    sha?: string;
    done?: boolean;
    error?: string;
    created_at?: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/builds",
      path: {
        "site_id": siteId,
      },
      body: build,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteBuild({
    buildId,
  }: {
    buildId: string;
  }): CancelablePromise<{
    id?: string;
    deploy_id?: string;
    sha?: string;
    done?: boolean;
    error?: string;
    created_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/builds/{build_id}",
      path: {
        "build_id": buildId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public notifyBuildStart({
    buildId,
  }: {
    buildId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/builds/{build_id}/start",
      path: {
        "build_id": buildId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getAccountBuildStatus({
    accountId,
  }: {
    accountId: string;
  }): CancelablePromise<
    Array<{
      active?: number;
      pending_concurrency?: number;
      enqueued?: number;
      build_count?: number;
      minutes?: {
        current?: number;
        current_average_sec?: number;
        previous?: number;
        period_start_date?: string;
        period_end_date?: string;
        last_updated_at?: string;
        included_minutes?: string;
        included_minutes_with_packs?: string;
      };
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/{account_id}/builds/status",
      path: {
        "account_id": accountId,
      },
    });
  }
}
