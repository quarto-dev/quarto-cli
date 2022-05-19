/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from "../core/CancelablePromise.ts";
import type { BaseHttpRequest } from "../core/BaseHttpRequest.ts";

export class DeployKeyService {
  constructor(public readonly httpRequest: BaseHttpRequest) {}

  /**
   * @returns any OK
   * @throws ApiError
   */
  public listDeployKeys(): CancelablePromise<
    Array<{
      id?: string;
      public_key?: string;
      created_at?: string;
    }>
  > {
    return this.httpRequest.request({
      method: "GET",
      url: "/deploy_keys",
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public createDeployKey(): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "POST",
      url: "/deploy_keys",
    });
  }

  /**
   * @returns any OK
   * @throws ApiError
   */
  public getDeployKey({
    keyId,
  }: {
    keyId: string;
  }): CancelablePromise<{
    id?: string;
    public_key?: string;
    created_at?: string;
  }> {
    return this.httpRequest.request({
      method: "GET",
      url: "/deploy_keys/{key_id}",
      path: {
        "key_id": keyId,
      },
    });
  }

  /**
   * @returns any error
   * @throws ApiError
   */
  public deleteDeployKey({
    keyId,
  }: {
    keyId: string;
  }): CancelablePromise<{
    code?: number;
    message: string;
  }> {
    return this.httpRequest.request({
      method: "DELETE",
      url: "/deploy_keys/{key_id}",
      path: {
        "key_id": keyId,
      },
    });
  }
}
