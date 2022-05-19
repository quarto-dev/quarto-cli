/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class SnippetService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteSnippets({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: number;
      site_id?: string;
      title?: string;
      general?: string;
      general_position?: string;
      goal?: string;
      goal_position?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/snippets",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createSiteSnippet({
    siteId,
    snippet,
  }: {
    siteId: string;
    snippet: {
      id?: number;
      site_id?: string;
      title?: string;
      general?: string;
      general_position?: string;
      goal?: string;
      goal_position?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/sites/{site_id}/snippets",
      path: {
        "site_id": siteId,
      },
      body: snippet,
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteSnippet({
    siteId,
    snippetId,
  }: {
    siteId: string;
    snippetId: string;
  }): CancelablePromise<{
    id?: number;
    site_id?: string;
    title?: string;
    general?: string;
    general_position?: string;
    goal?: string;
    goal_position?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/snippets/{snippet_id}",
      path: {
        "site_id": siteId,
        "snippet_id": snippetId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateSiteSnippet({
    siteId,
    snippetId,
    snippet,
  }: {
    siteId: string;
    snippetId: string;
    snippet: {
      id?: number;
      site_id?: string;
      title?: string;
      general?: string;
      general_position?: string;
      goal?: string;
      goal_position?: string;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/sites/{site_id}/snippets/{snippet_id}",
      path: {
        "site_id": siteId,
        "snippet_id": snippetId,
      },
      body: snippet,
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteSiteSnippet({
    siteId,
    snippetId,
  }: {
    siteId: string;
    snippetId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/sites/{site_id}/snippets/{snippet_id}",
      path: {
        "site_id": siteId,
        "snippet_id": snippetId,
      },
    });
  }
}
