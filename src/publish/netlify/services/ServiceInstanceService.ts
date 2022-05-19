/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class ServiceInstanceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listServiceInstancesForSite({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      url?: string;
      config?: any;
      external_attributes?: any;
      service_slug?: string;
      service_path?: string;
      service_name?: string;
      env?: any;
      snippets?: Array<any>;
      auth_url?: string;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/service-instances",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createServiceInstance({
    siteId,
    addon,
    config,
  }: {
    siteId: string;
    addon: string;
    config: any;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/services/{addon}/instances",
      path: {
        "site_id": siteId,
        "addon": addon,
      },
      body: config,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public showServiceInstance({
    siteId,
    addon,
    instanceId,
  }: {
    siteId: string;
    addon: string;
    instanceId: string;
  }): CancelablePromise<{
    id?: string;
    url?: string;
    config?: any;
    external_attributes?: any;
    service_slug?: string;
    service_path?: string;
    service_name?: string;
    env?: any;
    snippets?: Array<any>;
    auth_url?: string;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/services/{addon}/instances/{instance_id}",
      path: {
        "site_id": siteId,
        "addon": addon,
        "instance_id": instanceId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateServiceInstance({
    siteId,
    addon,
    instanceId,
    config,
  }: {
    siteId: string;
    addon: string;
    instanceId: string;
    config: any;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/services/{addon}/instances/{instance_id}",
      path: {
        "site_id": siteId,
        "addon": addon,
        "instance_id": instanceId,
      },
      body: config,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteServiceInstance({
    siteId,
    addon,
    instanceId,
  }: {
    siteId: string;
    addon: string;
    instanceId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/sites/{site_id}/services/{addon}/instances/{instance_id}",
      path: {
        "site_id": siteId,
        "addon": addon,
        "instance_id": instanceId,
      },
    });
  }
}
