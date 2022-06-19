/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

import {
  AccessToken,
  AccountSite,
  PublishDeploy,
  Site,
  Ticket,
} from "./types.ts";

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
  public createTicket = (client_id: string): Promise<Ticket> =>
    this.fetchJSON(
      "POST",
      `tickets?${new URLSearchParams({ application_id: client_id })}`,
    );

  // Shows a ticket.
  public showTicket = (id: string): Promise<Ticket> =>
    this.fetchJSON("GET", `tickets/${id}`);

  // Exchanges a ticket for an access token.
  public exchangeTicket = (id: string): Promise<AccessToken> =>
    this.fetchJSON("POST", `tickets/${id}/exchange`);

  // Checks if a slug is available.
  public slugAvailable = async (slug: string): Promise<boolean> => {
    try {
      await this.fetch("HEAD", `slugs/${slug}`);
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
    this.fetchJSON("POST", "sites", new URLSearchParams({ type, title, slug }));

  // Creates a site deploy.
  public createDeploy = (
    siteId: string,
    files: Record<string, string>,
  ): Promise<PublishDeploy> =>
    this.fetchJSON("POST", `sites/${siteId}/deploys`, JSON.stringify(files));

  // Gets a deploy.
  public getDeploy = (deployId: string): Promise<PublishDeploy> =>
    this.fetchJSON("GET", `deploys/${deployId}`);

  // Uploads a deploy file.
  public uploadDeployFile = (
    deployId: string,
    path: string,
    fileBody: Blob,
  ): Promise<void> =>
    this.fetch("PUT", `deploys/${deployId}/files/${path}`, fileBody);

  public updateAccountSite = (): Promise<AccountSite> =>
    this.fetchJSON("PUT", "update-account-site");

  // Performs a fetch returning JSON.
  private fetchJSON = async <T>(
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<T> => {
    // Perform the fetch.
    const response = await fetch(this.createURL(path), {
      method,
      headers: {
        Accept: "application/json",
        ...authorizationHeader(this.token_),
      },
      body,
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the JSON as the specified type.
    return <T> await response.json();
  };

  // Performs a fetch.
  private fetch = async (
    method: string,
    path: string,
    body?: BodyInit | null,
  ): Promise<void> => {
    // Perform the fetch.
    const response = await fetch(this.createURL(path), {
      method,
      headers: {
        ...authorizationHeader(this.token_),
      },
      body,
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }
  };

  // Creates a URL.
  private createURL = (path: string) => `${this.baseURL_}/${path}`;
}

// Creates an authorization header, if a token was supplied.
const authorizationHeader = (
  token?: string,
): HeadersInit => (!token ? {} : { Authorization: `Bearer ${token}` });
