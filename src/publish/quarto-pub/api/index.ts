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

// The Accept: application/json header.
const acceptApplicationJsonHeader = {
  Accept: "application/json",
};

// The Content-Type: application/json header.
const contentTypeApplicationJsonHeader = {
  "Content-Type": "application/json",
};

// Creates an authorization header, if a token was supplied.
const authorizationHeader = (
  token?: string,
): HeadersInit => (!token ? {} : { Authorization: `Bearer ${token}` });

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

      case "PRODUCTION":
      default:
        this.baseURL_ = "https://quartopub.com/api/v1";
        break;
    }
  }

  // Creates a ticket.
  public createTicket = async (client_id: string): Promise<Ticket> => {
    const response = await fetch(
      this.createURL(
        `tickets?${new URLSearchParams({ application_id: client_id })}`,
      ),
      {
        method: "POST",
        headers: {
          ...authorizationHeader(this.token_),
          ...acceptApplicationJsonHeader,
        },
      },
    );

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <Ticket> await response.json();
  };

  // Shows a ticket.
  public showTicket = async (id: string): Promise<Ticket> => {
    // Perform the operation.
    const response = await fetch(this.createURL(`tickets/${id}`), {
      method: "GET",
      headers: {
        ...authorizationHeader(this.token_),
        ...acceptApplicationJsonHeader,
      },
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <Ticket> await response.json();
  };

  // Exchanges a ticket for an access token.
  public exchangeTicket = async (id: string): Promise<AccessToken> => {
    // Perform the operation.
    const response = await fetch(this.createURL(`tickets/${id}/exchange`), {
      method: "POST",
      headers: {
        ...authorizationHeader(this.token_),
        ...acceptApplicationJsonHeader,
      },
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <AccessToken> await response.json();
  };

  // Checks if a slug is available.
  public slugAvailable = async (slug: string): Promise<boolean> => {
    // Perform the operation.
    const response = await fetch(this.createURL(`slugs/${slug}`), {
      method: "HEAD",
      headers: {
        ...authorizationHeader(this.token_),
      },
    });

    // If the response was not OK, the slug is unavailable.
    if (response.ok) {
      return false;
    }

    // If the response was 404, the slug is available.
    if (response.status == 404) {
      return true;
    }

    // Any other response is an error.
    throw new ApiError(response.status, response.statusText);
  };

  // Creates a site.
  public createSite = async (
    type: string,
    title: string,
    slug: string,
  ): Promise<Site> => {
    // Perform the operation.
    const response = await fetch(this.createURL("sites"), {
      method: "POST",
      headers: {
        ...authorizationHeader(this.token_),
        ...acceptApplicationJsonHeader,
      },
      body: new URLSearchParams({ type, title, slug }),
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <Site> await response.json();
  };

  // Creates a site deploy.
  public createDeploy = async (
    siteId: string,
    files: Record<string, string>,
    size: number,
  ): Promise<PublishDeploy> => {
    // Perform the operation.
    const response = await fetch(
      this.createURL(`sites/${siteId}/deploys`),
      {
        method: "POST",
        headers: {
          ...authorizationHeader(this.token_),
          ...acceptApplicationJsonHeader,
          ...contentTypeApplicationJsonHeader,
        },
        body: JSON.stringify({
          size,
          files,
        }),
        // body: JSON.stringify(files),
      },
    );

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <PublishDeploy> await response.json();
  };

  // Gets a deploy.
  public getDeploy = async (deployId: string): Promise<PublishDeploy> => {
    // Perform the operation.
    const response = await fetch(this.createURL(`deploys/${deployId}`), {
      method: "GET",
      headers: {
        ...authorizationHeader(this.token_),
        ...acceptApplicationJsonHeader,
      },
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <PublishDeploy> await response.json();
  };

  // Uploads a deploy file.
  public uploadDeployFile = async (
    deployId: string,
    path: string,
    fileBody: Blob,
  ): Promise<void> => {
    // Perform the operation.
    const response = await fetch(
      this.createURL(`deploys/${deployId}/files/${path}`),
      {
        method: "PUT",
        headers: {
          ...authorizationHeader(this.token_),
        },
        body: fileBody,
      },
    );

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }
  };

  // Updates the account site.
  public updateAccountSite = async (): Promise<AccountSite> => {
    // Perform the operation.
    const response = await fetch(this.createURL("update-account-site"), {
      method: "PUT",
      headers: {
        ...authorizationHeader(this.token_),
        ...acceptApplicationJsonHeader,
      },
    });

    // If the response was not OK, throw an ApiError.
    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    // Return the result.
    return <AccountSite> await response.json();
  };

  // Creates a URL.
  private createURL = (path: string) => `${this.baseURL_}/${path}`;
}
