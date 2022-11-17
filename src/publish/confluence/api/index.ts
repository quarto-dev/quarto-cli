/*
 * index.ts
 *
 * Copyright (C) 2020 by RStudio, PBC
 *
 */

import { encode as base64encode } from "encoding/base64.ts";
import { ensureTrailingSlash } from "../../../core/path.ts";

import { AccountToken } from "../../provider.ts";
import { ApiError } from "../../types.ts";
import {
  Content,
  ContentArray,
  ContentCreate,
  ContentDelete,
  ContentSummary,
  ContentUpdate,
  Space,
  User,
  WrappedResult,
} from "./types.ts";
import { DESCENDANT_LIMIT } from "../constants.ts";

export class ConfluenceClient {
  public constructor(private readonly token_: AccountToken) {}

  public getUser(): Promise<User> {
    return this.get<User>("user/current");
  }

  public getSpace(spaceId: string): Promise<Space> {
    return this.get<Space>(`space/${spaceId}`);
  }

  public getContent(id: string): Promise<Content> {
    return this.get<Content>(`content/${id}`);
  }

  public getContentProperty(id: string): Promise<Content> {
    return this.get<Content>(`content/${id}/property`);
  }

  public getDescendants(
    id: string,
    expand = ["metadata.properties"]
  ): Promise<WrappedResult<ContentSummary>> {
    const url = `content/${id}/descendant/page?limit=${DESCENDANT_LIMIT}&expand=${expand}`;
    return this.get<WrappedResult<ContentSummary>>(url);
  }

  public async isTitleInSpace(title: string, space: Space): Promise<boolean> {
    const result = await this.fetchMatchingTitlePages(title, space);
    return result.length > 0;
  }

  public async fetchMatchingTitlePages(
    title: string,
    space: Space
  ): Promise<Content[]> {
    const cqlContext =
      "%7B%22contentStatuses%22%3A%5B%22archived%22%2C%20%22current%22%2C%20%22draft%22%5D%7D"; //{"contentStatuses":["archived", "current", "draft"]}
    const cql = `title="${title}" and space=${space.key}&cqlcontext=${cqlContext}`;
    const result = await this.get<ContentArray>(`content/search?cql=${cql}`);
    return result?.results ?? [];
  }

  public createContent(content: ContentCreate): Promise<Content> {
    return this.post<Content>("content", JSON.stringify(content));
  }

  public createContentProperty(id: string, content: any): Promise<Content> {
    return this.post<Content>(
      `content/${id}/property`,
      JSON.stringify(content)
    );
  }

  public updateContent(content: ContentUpdate): Promise<Content> {
    return this.put<Content>(`content/${content.id}`, JSON.stringify(content));
  }

  public deleteContent(content: ContentDelete): Promise<Content> {
    return this.delete<Content>(`content/${content.id}`);
  }

  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);

  private delete = <T>(path: string): Promise<T> =>
    this.fetch<T>("DELETE", path);

  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);

  private put = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("PUT", path, body);

  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null
  ): Promise<T> => {
    const headers = {
      Accept: "application/json",
      ...(["POST", "PUT"].includes(method)
        ? { "Content-Type": "application/json" }
        : {}),
      ...this.authorizationHeader(),
    };
    const request = {
      method,
      headers,
      body,
    };
    return this.handleResponse<T>(await fetch(this.apiUrl(path), request));
  };

  private apiUrl = (path: string) =>
    `${ensureTrailingSlash(this.token_.server!)}wiki/rest/api/${path}`;

  private authorizationHeader() {
    const auth = base64encode(this.token_.name + ":" + this.token_.token);
    return {
      Authorization: `Basic ${auth}`,
    };
  }

  private handleResponse<T>(response: Response) {
    if (response.ok) {
      if (response.body) {
        return response.json() as unknown as T;
      } else {
        return response as unknown as T;
      }
    } else if (response.status !== 200) {
      //TODO log levels to show extended error messages
      console.error("response.status !== 200", response);
      throw new ApiError(response.status, response.statusText);
    } else {
      console.error("other error", response);
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }
}
