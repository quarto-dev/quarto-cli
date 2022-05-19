/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class HookService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listHooksBySiteId({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      site_id?: string;
      type?: string;
      event?: string;
      data?: any;
      created_at?: string;
      updated_at?: string;
      disabled?: boolean;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/hooks",
      query: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createHookBySiteId({
    siteId,
    hook,
  }: {
    siteId: string;
    hook: {
      id?: string;
      site_id?: string;
      type?: string;
      event?: string;
      data?: any;
      created_at?: string;
      updated_at?: string;
      disabled?: boolean;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/hooks",
      query: {
        "site_id": siteId,
      },
      body: hook,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getHook({
    hookId,
  }: {
    hookId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    type?: string;
    event?: string;
    data?: any;
    created_at?: string;
    updated_at?: string;
    disabled?: boolean;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/hooks/{hook_id}",
      path: {
        "hook_id": hookId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public updateHook({
    hookId,
    hook,
  }: {
    hookId: string;
    hook: {
      id?: string;
      site_id?: string;
      type?: string;
      event?: string;
      data?: any;
      created_at?: string;
      updated_at?: string;
      disabled?: boolean;
    };
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    type?: string;
    event?: string;
    data?: any;
    created_at?: string;
    updated_at?: string;
    disabled?: boolean;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/hooks/{hook_id}",
      path: {
        "hook_id": hookId,
      },
      body: hook,
    });
  }

  /**
   * @returns void
   * @throws ApiError
   */
  public deleteHook({
    hookId,
  }: {
    hookId: string;
  }): CancelablePromise<void> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/hooks/{hook_id}",
      path: {
        "hook_id": hookId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public enableHook({
    hookId,
  }: {
    hookId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    type?: string;
    event?: string;
    data?: any;
    created_at?: string;
    updated_at?: string;
    disabled?: boolean;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/hooks/{hook_id}/enable",
      path: {
        "hook_id": hookId,
      },
    });
  }
}
