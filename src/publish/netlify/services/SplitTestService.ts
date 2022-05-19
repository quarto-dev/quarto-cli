/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class SplitTestService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSplitTest({
    siteId,
    branchTests,
  }: {
    siteId: string;
    branchTests: {
      branch_tests?: any;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/traffic_splits",
      path: {
        "site_id": siteId,
      },
      body: branchTests,
    });
  }

  /**
   * @returns any split_tests
   * @throws ApiError
   */
  public getSplitTests({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      site_id?: string;
      name?: string;
      path?: string;
      branches?: Array<any>;
      active?: boolean;
      created_at?: string;
      updated_at?: string;
      unpublished_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/traffic_splits",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateSplitTest({
    siteId,
    splitTestId,
    branchTests,
  }: {
    siteId: string;
    splitTestId: string;
    branchTests: {
      branch_tests?: any;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/traffic_splits/{split_test_id}",
      path: {
        "site_id": siteId,
        "split_test_id": splitTestId,
      },
      body: branchTests,
    });
  }

  /**
   * @returns any split_test
   * @throws ApiError
   */
  public getSplitTest({
    siteId,
    splitTestId,
  }: {
    siteId: string;
    splitTestId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    name?: string;
    path?: string;
    branches?: Array<any>;
    active?: boolean;
    created_at?: string;
    updated_at?: string;
    unpublished_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/traffic_splits/{split_test_id}",
      path: {
        "site_id": siteId,
        "split_test_id": splitTestId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public enableSplitTest({
    siteId,
    splitTestId,
  }: {
    siteId: string;
    splitTestId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/traffic_splits/{split_test_id}/publish",
      path: {
        "site_id": siteId,
        "split_test_id": splitTestId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public disableSplitTest({
    siteId,
    splitTestId,
  }: {
    siteId: string;
    splitTestId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/traffic_splits/{split_test_id}/unpublish",
      path: {
        "site_id": siteId,
        "split_test_id": splitTestId,
      },
    });
  }
}
