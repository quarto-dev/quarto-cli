/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import { AccessToken, PublishDeploy, Site, Ticket } from "./types.ts";

// TODO.
export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`API Error: ${status} (${statusText})`);
  }
}

export class QuartoPubClient {
  private readonly baseURL_: string;
  constructor(environment: string, private readonly token_?: string) {
    switch (environment) {
      case "LOCAL":
        this.baseURL_ = "http://localhost:3000/api/v1";
        break;

      case "DEV":
        this.baseURL_ = "https://quartodev.pub/api/v1";
        break;

      case "PRODUCTION":
      default:
        // TODO: Eventually this will point to the live site, when we know the domain.
        // For now, it points to the DEV environment.
        this.baseURL_ = "https://quartopub.org/api/v1";
        break;
    }
  }

  // Creates a ticket.
  public createTicket = (clientId: string): Promise<Ticket> =>
    this.post(`tickets?${new URLSearchParams({ applicationId: clientId })}`);

  // Shows a ticket.
  public showTicket = (id: string): Promise<Ticket> =>
    this.get(`tickets/${id}`);

  // Exchanges a ticket for an access token.
  public exchangeTicket = (id: string): Promise<AccessToken> =>
    this.post(`tickets/${id}/exchange`);

  // Checks if a slug is available.
  public slugAvailable = async (slug: string): Promise<boolean> => {
    try {
      await this.head(`slugs/${slug}`);
      return false;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return true;
      }

      throw error;
    }
  };

  // Creates a site.
  public createSite = (
    type: string,
    title: string,
    slug: string,
  ): Promise<Site> =>
    this.post<Site>("sites", new URLSearchParams({ type, title, slug }));

  // Creates a site deploy.
  public createDeploy = (
    siteId: string,
    files: Record<string, string>,
  ): Promise<PublishDeploy> =>
    this.post(`sites/${siteId}/deploys`, JSON.stringify(files));

  // Gets a deploy.
  public getDeploy = (deployId: string): Promise<PublishDeploy> =>
    this.get(`deploys/${deployId}`);

  // Uploads a deploy file.
  public uploadDeployFile = (
    deployId: string,
    path: string,
    fileBody: Blob,
  ): Promise<void> => this.put(`deploys/${deployId}/files/${path}`, fileBody);

  // Performs a HEAD.
  private head = (path: string): Promise<void> => this.fetch("HEAD", path);

  // Performs a GET.
  private get = <T>(path: string): Promise<T> => this.fetch<T>("GET", path);

  // Performs a POST.
  private post = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("POST", path, body);

  // Performs a PUT.
  private put = <T>(path: string, body?: BodyInit | null): Promise<T> =>
    this.fetch<T>("PUT", path, body);

  // Performs a fetch.
  private fetch = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<T> => {
    return handleResponse<T>(
      await fetch(this.createURL(path), {
        method,
        headers: {
          Accept: "application/json",
          ...authorizationHeader(this.token_),
        },
        body,
      }),
    );
  };

  // Creates a URL.
  private createURL = (path: string) => `${this.baseURL_}/${path}`;
}

// Creates an authorization header, if a token was supplied.
const authorizationHeader = (
  token?: string,
): HeadersInit => (!token ? {} : { Authorization: `Bearer ${token}` });

// Handles a response. TODO.
const handleResponse = <T>(response: Response) => {
  if (!response.ok) {
    throw new ApiError(response.status, response.statusText);
  } else {
    return response.json() as unknown as T;
  }
};
