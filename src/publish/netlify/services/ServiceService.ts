/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class ServiceService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any services
   * @throws ApiError
   */
  public getServices({
    search,
  }: {
    search?: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      name?: string;
      slug?: string;
      service_path?: string;
      long_description?: string;
      description?: string;
      events?: Array<any>;
      tags?: Array<string>;
      icon?: string;
      manifest_url?: string;
      environments?: Array<string>;
      created_at?: string;
      updated_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/services/",
      query: {
        "search": search,
      },
    });
  }

  /**
   * @returns any services
   * @throws ApiError
   */
  public showService({
    addonName,
  }: {
    addonName: string;
  }): CancelablePromise<{
    id?: string;
    name?: string;
    slug?: string;
    service_path?: string;
    long_description?: string;
    description?: string;
    events?: Array<any>;
    tags?: Array<string>;
    icon?: string;
    manifest_url?: string;
    environments?: Array<string>;
    created_at?: string;
    updated_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/services/{addonName}",
      path: {
        "addonName": addonName,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public showServiceManifest({
    addonName,
  }: {
    addonName: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/services/{addonName}/manifest",
      path: {
        "addonName": addonName,
      },
    });
  }
}
