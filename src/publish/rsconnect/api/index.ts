/*
* index.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { wrapFetch } from "another_cookiejar/mod.ts";
const fetch = wrapFetch();

import { ensureProtocolAndTrailingSlash } from "../../../core/url.ts";
import { ApiError } from "../../types.ts";
import { Bundle, Content, Task, TaskStatus, User } from "./types.ts";

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

  public getContent(guid: string): Promise<Content> {
    return this.get<Content>(`content/${guid}`);
  }

  public uploadBundle(guid: string, fileBody: Blob): Promise<Bundle> {
    return this.post<Bundle>(`content/${guid}/bundles`, fileBody);
  }

  public deployBundle(bundle: Bundle): Promise<Task> {
    return this.post<Task>(
      `content/${bundle.content_guid}/deploy`,
      JSON.stringify({ bundle_id: bundle.id }),
    );
  }

  public getTaskStatus(task: Task): Promise<TaskStatus> {
    return this.get<TaskStatus>(
      `tasks/${task.task_id}?${new URLSearchParams({ wait: "1" })}`,
    );
  }

  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);
  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);
  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<T> => {
    return this.handleResponse<T>(
      await fetch(this.apiUrl(path), {
        method,
        //     credentials: "include",
        headers: {
          Accept: "application/json",
          ...authorizationHeader(this.key_),
        },
        body,
      }),
    );
  };

  private apiUrl = (path: string) => `${this.server_}__api__/v1/${path}`;

  private handleResponse<T>(response: Response) {
    if (response.ok) {
      return response.json() as unknown as T;
    } else if (response.status !== 200) {
      throw new ApiError(response.status, response.statusText);
    } else {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }

  private cookies_ = new Map<string, string>();
}

const authorizationHeader = (
  key?: string,
): HeadersInit => (!key ? {} : { Authorization: `Key ${key}` });
