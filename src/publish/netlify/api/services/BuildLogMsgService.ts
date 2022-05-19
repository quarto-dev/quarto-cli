/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class BuildLogMsgService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any error
   * @throws ApiError
   */
  public updateSiteBuildLog({
    buildId,
    msg,
  }: {
    buildId: string;
    msg: {
      message?: string;
      error?: boolean;
    };
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/builds/{build_id}/log",
      path: {
        "build_id": buildId,
      },
      body: msg,
    });
  }
}
