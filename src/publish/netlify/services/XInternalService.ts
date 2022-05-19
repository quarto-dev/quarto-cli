/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class XInternalService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * This is an internal-only endpoint.
   * @returns any OK
   * @throws ApiError
   */
  public updatePlugin({
    siteId,
    _package,
    pluginParams,
  }: {
    siteId: string;
    _package: string;
    pluginParams?: {
      pinned_version?: string;
    };
  }): CancelablePromise<{
    package?: string;
    pinned_version?: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/plugins/{package}",
      path: {
        "site_id": siteId,
        "package": _package,
      },
      body: pluginParams,
    });
  }

  /**
   * This is an internal-only endpoint.
   * @returns any OK
   * @throws ApiError
   */
  public getLatestPluginRuns({
    siteId,
    packages,
    state,
  }: {
    siteId: string;
    packages: Array<string>;
    state?: string;
  }): CancelablePromise<
    Array<
      ({
        package?: string;
        version?: string;
        state?: string;
        reporting_event?: string;
        title?: string;
        summary?: string;
        text?: string;
      } & {
        deploy_id?: string;
      })
    >
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/plugin_runs/latest",
      path: {
        "site_id": siteId,
      },
      query: {
        "packages": packages,
        "state": state,
      },
    });
  }

  /**
   * This is an internal-only endpoint.
   * @returns any error
   * @throws ApiError
   */
  public createPluginRun({
    deployId,
    pluginRun,
  }: {
    deployId: string;
    pluginRun?: {
      package?: string;
      version?: string;
      state?: string;
      reporting_event?: string;
      title?: string;
      summary?: string;
      text?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/deploys/{deploy_id}/plugin_runs",
      path: {
        "deploy_id": deployId,
      },
      body: pluginRun,
    });
  }
}
