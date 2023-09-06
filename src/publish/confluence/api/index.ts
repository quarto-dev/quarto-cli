/*
 * index.ts
 *
 * Copyright (C) 2020 by Posit, PBC
 */

import { encode as base64encode } from "encoding/base64.ts";
import { ensureTrailingSlash } from "../../../core/path.ts";

import { AccountToken } from "../../provider-types.ts";
import { ApiError } from "../../types.ts";
import {
  AttachmentSummary,
  ConfluenceParent,
  Content,
  ContentArray,
  ContentChangeType,
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

import {
  CAN_SET_PERMISSIONS_DISABLED,
  CAN_SET_PERMISSIONS_ENABLED_CACHED,
  DESCENDANT_PAGE_SIZE,
  V2EDITOR_METADATA,
} from "../constants.ts";
import { logError, trace } from "../confluence-logger.ts";
import { buildContentCreate } from "../confluence-helper.ts";

export class ConfluenceClient {
  public constructor(private readonly token_: AccountToken) {}

  public getUser(expand = ["operations"]): Promise<User> {
    return this.get<User>(`user/current?expand=${expand}`);
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

  public getDescendantsPage(
    id: string,
    start: number = 0,
    expand = ["metadata.properties", "ancestors"],
  ): Promise<WrappedResult<ContentSummary>> {
    const url =
      `content/${id}/descendant/page?limit=${DESCENDANT_PAGE_SIZE}&start=${start}&expand=${expand}`;
    return this.get<WrappedResult<ContentSummary>>(url);
  }

  public async isTitleUniqueInSpace(
    title: string,
    space: Space,
    idToIgnore: string = "",
  ): Promise<boolean> {
    const result = await this.fetchMatchingTitlePages(title, space);

    if (result.length === 1 && result[0].id === idToIgnore) {
      return true;
    }

    return result.length === 0;
  }

  public async fetchMatchingTitlePages(
    title: string,
    space: Space,
    isFuzzy: boolean = false,
  ): Promise<Content[]> {
    const encodedTitle = encodeURIComponent(title);

    let cql = `title="${encodedTitle}"`;

    const CQL_CONTEXT =
      "%7B%22contentStatuses%22%3A%5B%22archived%22%2C%20%22current%22%2C%20%22draft%22%5D%7D"; //{"contentStatuses":["archived", "current", "draft"]}

    cql = `${cql}&spaces=${space.key}&cqlcontext=${CQL_CONTEXT}`;

    const result = await this.get<ContentArray>(`content/search?cql=${cql}`);
    return result?.results ?? [];
  }

  /**
   * Perform a test to see if the user can manage permissions.  In the space create a simple test page, attempt to set
   * permissions on it, then delete it.
   */
  public async canSetPermissions(
    parent: ConfluenceParent,
    space: Space,
    user: User,
  ): Promise<boolean> {
    let result = true;

    trace("canSetPermissions check");

    trace(
      "localStorage.getItem(CAN_SET_PERMISSIONS_DISABLED)",
      localStorage.getItem(CAN_SET_PERMISSIONS_DISABLED),
    );
    trace(
      "localStorage.getItem(CAN_SET_PERMISSIONS_ENABLED_CACHED)",
      localStorage.getItem(CAN_SET_PERMISSIONS_ENABLED_CACHED),
    );

    const permissionsTestDisabled =
      localStorage.getItem(CAN_SET_PERMISSIONS_DISABLED) === "true" ||
      localStorage.getItem(CAN_SET_PERMISSIONS_ENABLED_CACHED) === "true";

    trace("permissionsTestDisabled", permissionsTestDisabled);

    if (permissionsTestDisabled) {
      return Promise.resolve(true);
    }

    const testContent: ContentCreate = buildContentCreate(
      `quarto-permission-test-${globalThis.crypto.randomUUID()}`,
      space,
      {
        storage: {
          value: "",
          representation: "storage",
        },
      },
      "permisson-test",
    );
    const testContentCreated = await this.createContent(user, testContent);

    const testContentId = testContentCreated.id ?? "";

    try {
      await this.put<Content>(
        `content/${testContentId}/restriction/byOperation/update/user?accountId=${user.accountId}`,
      );
    } catch (error) {
      trace("lockDownResult Error", error);
      // Note, sometimes a successful call throws a
      // "SyntaxError: Unexpected end of JSON input"
      // check for the 403 status only
      if (error?.status === 403) {
        result = false;
      }
    }

    const contentDelete: ContentDelete = {
      id: testContentId,
      contentChangeType: ContentChangeType.delete,
    };

    let attemptArchive = false;
    try {
      await this.deleteContent(contentDelete);
    } catch (error) {
      trace("delete canSetPermissions Test Error", error);
      if (error?.status === 403) {
        //Delete is disabled for this user, attempt an archive
        attemptArchive = true;
      }
    }

    try {
      await this.archiveContent(contentDelete);
    } catch (error) {
      trace("archive canSetPermissions Test Error", error);
    }

    if (attemptArchive) {
      trace(
        "Disabling Permissions Test: confluenceCanSetPermissionsDisabled",
        "true",
      );
      // https://github.com/quarto-dev/quarto-cli/issues/5299
      // This account can't delete the test document, we attempted an archive
      // Let's prevent this "canSetPermissions" test from being run in the future
      localStorage.setItem(CAN_SET_PERMISSIONS_DISABLED, "true");
    }

    return result;
  }

  public async lockDownPermissions(
    contentId: string,
    user: User,
  ): Promise<any> {
    try {
      return await this.put<Content>(
        `content/${contentId}/restriction/byOperation/update/user?accountId=${user.accountId}`,
      );
    } catch (error) {
      trace("lockDownResult Error", error);
    }
  }

  public async createContent(
    user: User,
    content: ContentCreate,
    metadata: Record<string, any> = V2EDITOR_METADATA,
  ): Promise<Content> {
    const toCreate = {
      ...content,
      ...metadata,
    };

    trace("to create", toCreate);
    trace("createContent body", content.body.storage.value);
    const createBody = JSON.stringify(toCreate);
    const result: Content = await this.post<Content>("content", createBody);

    await this.lockDownPermissions(result.id ?? "", user);

    return result;
  }

  public async updateContent(
    user: User,
    content: ContentUpdate,
    metadata: Record<string, any> = V2EDITOR_METADATA,
  ): Promise<Content> {
    const toUpdate = {
      ...content,
      ...metadata,
    };

    const result = await this.put<Content>(
      `content/${content.id}`,
      JSON.stringify(toUpdate),
    );

    await this.lockDownPermissions(content.id ?? "", user);

    return result;
  }

  public createContentProperty(id: string, content: any): Promise<Content> {
    return this.post<Content>(
      `content/${id}/property`,
      JSON.stringify(content),
    );
  }

  public deleteContent(content: ContentDelete): Promise<Content> {
    trace("deleteContent", content);
    return this.delete<Content>(`content/${content.id}`);
  }

  public archiveContent(content: ContentDelete): Promise<Content> {
    trace("archiveContent", content);
    const toArchive = {
      pages: [
        {
          id: content.id,
        },
      ],
    };
    return this.post<Content>(`content/archive`, JSON.stringify(toArchive));
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
    comment: string = "",
  ): Promise<AttachmentSummary> {
    trace("createOrUpdateAttachment", { file, parentId }, LogPrefix.ATTACHMENT);

    const wrappedResult: WrappedResult<AttachmentSummary> = await this
      .putAttachment<WrappedResult<AttachmentSummary>>(
        `content/${parentId}/child/attachment`,
        file,
        comment,
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
    comment: string = "",
  ): Promise<T> => this.fetchWithAttachment<T>("PUT", path, file, comment);

  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
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
    comment: string = "",
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
    } else if (response.status === 403) {
      // Let parent handle 403 Forbidden, sometimes they are expected
      throw new ApiError(response.status, response.statusText);
    } else if (response.status !== 200) {
      logError("response.status !== 200", response);
      throw new ApiError(response.status, response.statusText);
    } else {
      logError("handleResponse", response);
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  }
}
