/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { encode as base64encode } from "encoding/base64.ts";

import { AccountToken } from "../../provider.ts";
import { ApiError } from "../../types.ts";
import { User } from "./types.ts";

export class ConfluenceClient {
  public constructor(private readonly token_: AccountToken) {
  }

  public getUser(): Promise<User> {
    return this.get<User>("user/current");
  }

  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);
  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);
  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<T> => {
    const headers = {
      Accept: "application/json",
      ...this.authorizationHeader(),
    };
    return this.handleResponse<T>(
      await fetch(this.apiUrl(path), {
        method,
        headers,
        body,
      }),
    );
  };

  private apiUrl = (path: string) =>
    `${this.token_.server}/wiki/rest/api/${path}`;

  private authorizationHeader() {
    const auth = base64encode(this.token_.name + ":" + this.token_.token);
    return {
      Authorization: `Basic ${auth}`,
    };
  }

  private handleResponse<T>(response: Response) {
    if (response.ok) {
      return response.json() as unknown as T;
    } else if (response.status !== 200) {
      throw new ApiError(response.status, response.statusText);
    } else {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }
}
