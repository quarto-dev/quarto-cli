/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { ensureProtocolAndTrailingSlash } from "../../../core/url.ts";
import { ApiError, Content, User } from "./types.ts";

export class RSConnectClient {
  public constructor(
    private readonly server_: string,
    private readonly key_?: string,
  ) {
    this.server_ = ensureProtocolAndTrailingSlash(this.server_);
  }

  public getUser(): Promise<User> {
    return this.get<User>("user");
  }

  public createContent(name: string, title: string): Promise<Content> {
    return this.post<Content>("content", JSON.stringify({ name, title }));
  }

  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);
  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);
  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<T> => {
    return handleResponse<T>(
      await fetch(this.apiUrl(path), {
        method,
        headers: {
          Accept: "application/json",
          ...authorizationHeader(this.key_),
        },
        body,
      }),
    );
  };

  private apiUrl = (path: string) => `${this.server_}__api__/v1/${path}`;
}

const authorizationHeader = (
  key?: string,
): HeadersInit => (!key ? {} : { Authorization: `Key ${key}` });

function handleResponse<T>(response: Response) {
  if (response.ok) {
    return response.json() as unknown as T;
  } else if (response.status !== 200) {
    throw new ApiError(response.status, response.statusText);
  } else {
    throw new Error(`${response.status} - ${response.statusText}`);
  }
}
