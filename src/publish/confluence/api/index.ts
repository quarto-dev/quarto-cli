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
  AttachmentSummary,
  Content,
  ContentArray,
  ContentCreate,
  ContentDelete,
  ContentProperty,
  ContentSummary,
  ContentUpdate,
  LogPrefix,
  Space,
  User,
  WrappedResult,
} from "./types.ts";

import { DESCENDANT_LIMIT, V2EDITOR_METADATA } from "../constants.ts";
import { logError, trace } from "../confluence-logger.ts";

export class ConfluenceClient {
  public constructor(private readonly token_: AccountToken) {}

  public getUser(): Promise<User> {
    return this.get<User>("user/current");
  }

  public getSpace(spaceId: string, expand = ["homepage"]): Promise<Space> {
    return this.get<Space>(`space/${spaceId}?expand=${expand}`);
  }

  public getContent(id: string): Promise<Content> {
    return this.get<Content>(`content/${id}`);
  }

  public async getContentProperty(id: string): Promise<ContentProperty[]> {
    const result: WrappedResult<ContentProperty> = await this.get<
      WrappedResult<ContentProperty>
    >(`content/${id}/property`);

    return result.results;
  }

  public getDescendants(
    id: string,
    expand = ["metadata.properties", "ancestors"]
  ): Promise<WrappedResult<ContentSummary>> {
    const url = `content/${id}/descendant/page?limit=${DESCENDANT_LIMIT}&expand=${expand}`;
    return this.get<WrappedResult<ContentSummary>>(url);
  }

  public async isTitleInSpace(
    title: string,
    space: Space,
    idToIgnore: string = ""
  ): Promise<boolean> {
    const result = await this.fetchMatchingTitlePages(title, space);

    if (result.length === 1 && result[0].id === idToIgnore) {
      return false;
    }

    return result.length > 0;
  }

  public async fetchMatchingTitlePages(
    title: string,
    space: Space
  ): Promise<Content[]> {
    const cqlContext =
      "%7B%22contentStatuses%22%3A%5B%22archived%22%2C%20%22current%22%2C%20%22draft%22%5D%7D"; //{"contentStatuses":["archived", "current", "draft"]}
    const encodedTitle = encodeURIComponent(title);
    const cql = `title="${encodedTitle}" and space=${space.key}&cqlcontext=${cqlContext}`;
    const result = await this.get<ContentArray>(`content/search?cql=${cql}`);
    return result?.results ?? [];
  }

  public createContent(
    content: ContentCreate,
    metadata: Record<string, any> = V2EDITOR_METADATA
  ): Promise<Content> {
    const toCreate = {
      ...content,
      ...metadata,
    };

    trace("to create", toCreate);
    trace("createContent body", content.body.storage.value);
    const createBody = JSON.stringify(toCreate);
    return this.post<Content>("content", createBody);
  }

  public updateContent(
    content: ContentUpdate,
    metadata: Record<string, any> = V2EDITOR_METADATA
  ): Promise<Content> {
    const toUpdate = {
      ...content,
      ...metadata,
    };
    trace("updateContent", toUpdate);
    return this.put<Content>(`content/${content.id}`, JSON.stringify(toUpdate));
  }

  public createContentProperty(id: string, content: any): Promise<Content> {
    return this.post<Content>(
      `content/${id}/property`,
      JSON.stringify(content)
    );
  }

  public deleteContent(content: ContentDelete): Promise<Content> {
    trace("deleteContent", content);
    return this.delete<Content>(`content/${content.id}`);
  }

  public async getAttachments(id: string): Promise<AttachmentSummary[]> {
    const wrappedResult: WrappedResult<AttachmentSummary> = await this.get<
      WrappedResult<AttachmentSummary>
    >(`content/${id}/child/attachment`);

    const result = wrappedResult?.results ?? [];
    return result;
  }

  public async createOrUpdateAttachment(
    parentId: string,
    file: File,
    comment: string = ""
  ): Promise<AttachmentSummary> {
    trace("createOrUpdateAttachment", { file, parentId }, LogPrefix.ATTACHMENT);

    const wrappedResult: WrappedResult<AttachmentSummary> =
      await this.putAttachment<WrappedResult<AttachmentSummary>>(
        `content/${parentId}/child/attachment`,
        file,
        comment
      );

    trace("createOrUpdateAttachment", wrappedResult, LogPrefix.ATTACHMENT);

    const result = wrappedResult.results[0] ?? null;
    return result;
  }

  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);

  private delete = <T>(path: string): Promise<T> =>
    this.fetch<T>("DELETE", path);

  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);

  private put = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("PUT", path, body);

  private putAttachment = <T>(
    path: string,
    file: File,
    comment: string = ""
  ): Promise<T> => this.fetchWithAttachment<T>("PUT", path, file, comment);

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

  private fetchWithAttachment = async <T>(
    method: string,
    path: string,
    file: File,
    comment: string = ""
  ): Promise<T> => {
    // https://blog.hyper.io/uploading-files-with-deno/
    const formData = new FormData();
    formData.append("file", file);
    formData.append("minorEdit", "true");
    formData.append("comment", comment);

    const headers = {
      ["X-Atlassian-Token"]: "nocheck",
      ...this.authorizationHeader(),
    };

    const request = {
      method,
      headers,
      body: formData,
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
      logError("response.status !== 200", response);
      throw new ApiError(response.status, response.statusText);
    } else {
      logError("handleResponse", response);
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }
}
