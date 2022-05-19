/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class FunctionService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public uploadDeployFunction({
    deployId,
    name,
    fileBody,
    runtime,
    size,
  }: {
    deployId: string;
    name: string;
    fileBody: Blob;
    runtime?: string;
    size?: number;
  }): CancelablePromise<{
    id?: string;
    name?: string;
    sha?: string;
  }> {
    return this.httpRequest.request({
      method: "PUT",
      url: "/deploys/{deploy_id}/functions/{name}",
      path: {
        "deploy_id": deployId,
        "name": name,
      },
      query: {
        "runtime": runtime,
        "size": size,
      },
      body: fileBody,
    });
  }
}
