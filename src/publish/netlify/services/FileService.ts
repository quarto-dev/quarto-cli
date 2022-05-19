/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class FileService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listSiteFiles({
    siteId,
  }: {
    siteId: string;
  }): CancelablePromise<
    Array<{
      id?: string;
      path?: string;
      sha?: string;
      mime_type?: string;
      size?: number;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/files",
      path: {
        "site_id": siteId,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getSiteFileByPathName({
    siteId,
    filePath,
  }: {
    siteId: string;
    filePath: string;
  }): CancelablePromise<{
    id?: string;
    path?: string;
    sha?: string;
    mime_type?: string;
    size?: number;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/sites/{site_id}/files/{file_path}",
      path: {
        "site_id": siteId,
        "file_path": filePath,
      },
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public uploadDeployFile({
    deployId,
    path,
    fileBody,
    size,
  }: {
    deployId: string;
    path: string;
    fileBody: Blob;
    size?: number;
  }): CancelablePromise<{
    id?: string;
    path?: string;
    sha?: string;
    mime_type?: string;
    size?: number;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/deploys/{deploy_id}/files/{path}",
      path: {
        "deploy_id": deployId,
        "path": path,
      },
      query: {
        "size": size,
      },
      body: fileBody,
    });
  }
}
