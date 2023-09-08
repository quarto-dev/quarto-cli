/*
 * index.ts
 *
 * Copyright (C) 2020-2023 Posit Software, PBC
 */

import { ApiError } from "../../types.ts";
import {
  Application,
  Bundle,
  Content,
  ErrorBody,
  OutputRevision,
  Task,
  User,
} from "./types.ts";

import { md5Hash } from "../../../core/hash.ts";
import { quartoConfig } from "../../../core/quarto.ts";

import { crypto } from "https://deno.land/std@0.185.0/crypto/mod.ts";

import {
  decode as base64Decode,
  encode as base64Encode,
} from "encoding/base64.ts";

interface FetchOpts {
  body?: string;
  queryParams?: Record<string, string>;
}

export class PositCloudClient {
  private key: CryptoKey | undefined;

  public constructor(
    private readonly server: string,
    private readonly token: string,
    private readonly token_secret: string,
  ) {
    this.server = server;
    this.token = token;
    this.token_secret = token_secret;
  }

  public getUser(): Promise<User> {
    return this.get<User>("users/me");
  }

  public getApplication(id: string): Promise<Application> {
    return this.get<Application>(`applications/${id}`);
  }

  public createOutput(
    name: string,
    spaceId: number | null,
    projectId: number | null,
    contentCategory: string | null,
  ): Promise<Content> {
    return this.post<Content>(
      "outputs",
      JSON.stringify({
        name: name,
        application_type: "static",
        space: spaceId,
        project: projectId,
        content_category: contentCategory,
      }),
    );
  }

  public setBundleReady(bundleId: number) {
    return this.post(
      `bundles/${bundleId}/status`,
      JSON.stringify({ status: "ready" }),
    );
  }
  public createBundle(
    applicationId: number,
    contentLength: number,
    checksum: string,
  ): Promise<Bundle> {
    return this.post<Bundle>(
      `bundles`,
      JSON.stringify({
        "application": applicationId,
        "content_type": "application/x-tar",
        "content_length": contentLength,
        "checksum": checksum,
      }),
    );
  }

  public getTask(id: number) {
    return this.get<Task>(`tasks/${id}`, { legacy: "false" });
  }

  public createRevision(outputId: number, contentCategory: string | null) {
    return this.post<OutputRevision>(
      `outputs/${outputId}/revisions`,
      JSON.stringify({
        content_category: contentCategory,
      }),
    );
  }

  public getContent(id: number | string): Promise<Content> {
    return this.get<Content>(`content/${id}`);
  }

  public deployApplication(
    applicationId: number,
    bundleId: number,
  ): Promise<Task> {
    return this.post<Task>(
      `applications/${applicationId}/deploy`,
      JSON.stringify({ "bundle": bundleId, rebuild: false }),
    );
  }

  private get = <T>(
    path: string,
    queryParams?: Record<string, string>,
  ): Promise<T> => this.fetch<T>("GET", path, { queryParams });
  private post = <T>(path: string, body?: string): Promise<T> =>
    this.fetch<T>("POST", path, { body });

  private fetch = async <T>(
    method: string,
    path: string,
    opts: FetchOpts,
  ): Promise<T> => {
    const fullPath = `/v1/${path}`;

    const pathAndQuery = opts.queryParams
      ? `${fullPath}?${opts.queryParams}`
      : fullPath;

    const url = `${this.server}${pathAndQuery}`;
    const authHeaders = await this.authorizationHeaders(
      method,
      fullPath,
      opts.body,
    );
    const contentTypeHeader: HeadersInit = opts.body
      ? { "Content-Type": "application/json" }
      : {};

    const headers = {
      Accept: "application/json",
      "User-Agent": `quarto-cli/${quartoConfig.version()}`,
      ...authHeaders,
      ...contentTypeHeader,
    };

    const requestInit: RequestInit = {
      method,
      headers,
      body: opts.body,
      redirect: "manual",
    };
    const request = new Request(url, requestInit);

    return await this.handleResponse<T>(
      await fetch(request),
    );
  };

  private handleResponse = async <T>(
    response: Response,
  ): Promise<T> => {
    if (response.status >= 200 && response.status < 400) {
      if (
        response.headers.get("Content-Type")?.startsWith("application/json")
      ) {
        return await response.json() as unknown as T;
      } else {
        return await response.text() as unknown as T;
      }
    } else if (response.status >= 400) {
      const json = await response.json() as unknown as ErrorBody;
      let errorDescription = undefined;
      if (json.error) {
        errorDescription = json.error;
        if (json.error_type) {
          errorDescription = `${errorDescription}, code=${json.error_type}`;
        }
      }
      throw new ApiError(
        response.status,
        response.statusText,
        errorDescription,
      );
    } else {
      throw new Error(`${response.status} - ${response.statusText}`);
    }
  };

  private authorizationHeaders = async (
    method: string,
    path: string,
    body?: string,
  ): Promise<HeadersInit> => {
    const date = new Date().toUTCString();
    const checksum = md5Hash(body || "");

    const canonicalRequest = [
      method,
      path,
      date,
      checksum,
    ].join("\n");

    const signature = await this.getSignature(canonicalRequest);

    return {
      "X-Auth-Token": this.token,
      "X-Auth-Signature": `${signature}; version=1`,
      "Date": date,
      "X-Content-Checksum": checksum,
    };
  };

  private async getSignature(data: string): Promise<string> {
    if (!this.key) {
      const decodedTokenSecret = base64Decode(this.token_secret);
      this.key = await crypto.subtle.importKey(
        "raw",
        decodedTokenSecret,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
    }

    const canonicalRequestBytes = new TextEncoder().encode(data);
    const signatureArrayBuffer = await crypto.subtle.sign(
      "HMAC",
      this.key,
      canonicalRequestBytes,
    );

    const signatureBytes = Array.from(new Uint8Array(signatureArrayBuffer));
    const signatureHex = signatureBytes
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return base64Encode(signatureHex);
  }
}

export class UploadClient {
  public constructor(
    private readonly url: string,
  ) {
    this.url = url;
  }

  upload = async (
    fileBody: Blob,
    bundleSize: number,
    presignedChecksum: string,
  ) => {
    const response = await fetch(this.url, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "content-type": "application/x-tar",
        "content-length": bundleSize.toString(),
        "content-md5": presignedChecksum,
      },
      body: fileBody,
    });

    if (!response.ok) {
      if (response.status !== 200) {
        throw new ApiError(response.status, response.statusText);
      } else {
        throw new Error(`${response.status} - ${response.statusText}`);
      }
    }
  };
}
