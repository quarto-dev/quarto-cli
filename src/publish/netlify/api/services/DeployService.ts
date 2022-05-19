/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class DeployService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteDeploys({
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
      site_id?: string;
      user_id?: string;
      build_id?: string;
      state?: string;
      name?: string;
      url?: string;
      ssl_url?: string;
      admin_url?: string;
      deploy_url?: string;
      deploy_ssl_url?: string;
      screenshot_url?: string;
      review_id?: number;
      draft?: boolean;
      required?: Array<string>;
      required_functions?: Array<string>;
      error_message?: string;
      branch?: string;
      commit_ref?: string;
      commit_url?: string;
      skipped?: boolean;
      created_at?: string;
      updated_at?: string;
      published_at?: string;
      title?: string;
      context?: string;
      locked?: boolean;
      review_url?: string;
      site_capabilities?: {
        large_media_enabled?: boolean;
      };
      framework?: string;
      function_schedules?: Array<{
        name?: string;
        cron?: string;
      }>;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/deploys",
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
  public createSiteDeploy({
    siteId,
    deploy,
    title,
  }: {
    siteId: string;
    deploy: {
      files?: any;
      draft?: boolean;
      async?: boolean;
      functions?: any;
      function_schedules?: Array<{
        name?: string;
        cron?: string;
      }>;
      branch?: string;
      framework?: string;
    };
    title?: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/deploys",
      path: {
        "site_id": siteId,
      },
      query: {
        "title": title,
      },
      body: deploy,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteDeploy({
    siteId,
    deployId,
  }: {
    siteId: string;
    deployId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/deploys/{deploy_id}",
      path: {
        "site_id": siteId,
        "deploy_id": deployId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public updateSiteDeploy({
    siteId,
    deployId,
    deploy,
  }: {
    siteId: string;
    deployId: string;
    deploy: {
      files?: any;
      draft?: boolean;
      async?: boolean;
      functions?: any;
      function_schedules?: Array<{
        name?: string;
        cron?: string;
      }>;
      branch?: string;
      framework?: string;
    };
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/deploys/{deploy_id}",
      path: {
        "site_id": siteId,
        "deploy_id": deployId,
      },
      body: deploy,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public cancelSiteDeploy({
    deployId,
  }: {
    deployId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/deploys/{deploy_id}/cancel",
      path: {
        "deploy_id": deployId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public restoreSiteDeploy({
    siteId,
    deployId,
  }: {
    siteId: string;
    deployId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/deploys/{deploy_id}/restore",
      path: {
        "site_id": siteId,
        "deploy_id": deployId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public rollbackSiteDeploy({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/rollback",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getDeploy({
    deployId,
  }: {
    deployId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/deploys/{deploy_id}",
      path: {
        "deploy_id": deployId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public lockDeploy({
    deployId,
  }: {
    deployId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/deploys/{deploy_id}/lock",
      path: {
        "deploy_id": deployId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public unlockDeploy({
    deployId,
  }: {
    deployId: string;
  }): CancelablePromise<{
    id?: string;
    site_id?: string;
    user_id?: string;
    build_id?: string;
    state?: string;
    name?: string;
    url?: string;
    ssl_url?: string;
    admin_url?: string;
    deploy_url?: string;
    deploy_ssl_url?: string;
    screenshot_url?: string;
    review_id?: number;
    draft?: boolean;
    required?: Array<string>;
    required_functions?: Array<string>;
    error_message?: string;
    branch?: string;
    commit_ref?: string;
    commit_url?: string;
    skipped?: boolean;
    created_at?: string;
    updated_at?: string;
    published_at?: string;
    title?: string;
    context?: string;
    locked?: boolean;
    review_url?: string;
    site_capabilities?: {
      large_media_enabled?: boolean;
    };
    framework?: string;
    function_schedules?: Array<{
      name?: string;
      cron?: string;
    }>;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/deploys/{deploy_id}/unlock",
      path: {
        "deploy_id": deployId,
      },
    });
  }
}
