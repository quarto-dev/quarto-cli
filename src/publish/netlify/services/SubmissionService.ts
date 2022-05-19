/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class SubmissionService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteSubmissions({
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
      number?: number;
      email?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      company?: string;
      summary?: string;
      body?: string;
      data?: any;
      created_at?: string;
      site_url?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/submissions",
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
  public listFormSubmissions({
    formId,
    page,
    perPage,
  }: {
    formId: string;
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      number?: number;
      email?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      company?: string;
      summary?: string;
      body?: string;
      data?: any;
      created_at?: string;
      site_url?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/forms/{form_id}/submissions",
      path: {
        "form_id": formId,
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
  public listFormSubmission({
    submissionId,
    query,
    page,
    perPage,
  }: {
    submissionId: string;
    query?: string;
    page?: number;
    perPage?: number;
  }): CancelablePromise<
    Array<{
      id?: string;
      number?: number;
      email?: string;
      name?: string;
      first_name?: string;
      last_name?: string;
      company?: string;
      summary?: string;
      body?: string;
      data?: any;
      created_at?: string;
      site_url?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/submissions/{submission_id}",
      path: {
        "submission_id": submissionId,
      },
      query: {
        "query": query,
        "page": page,
        "per_page": perPage,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteSubmission({
    submissionId,
  }: {
    submissionId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/submissions/{submission_id}",
      path: {
        "submission_id": submissionId,
      },
    });
  }
}
