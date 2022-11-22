/*
* index.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

import { ApiError } from "../../types.ts";
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

const kUrlResolveRegex = /https:\/\/quartopub\.com\/sites\/([^\/]+)\/(.*)/;

// Creates an authorization header, if a token was supplied.
const authorizationHeader = (
  token?: string,
): HeadersInit => (!token ? {} : { Authorization: `Bearer ${token}` });

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
    const site = <Site> await response.json();
    site.url = this.resolveUrl(site.url);
    return site;
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
      const description = await descriptionFromErrorResponse(response);
      throw new ApiError(response.status, description || response.statusText);
    }

    // Return the result.
    const deploy = <PublishDeploy> await response.json();
    deploy.url = this.resolveUrl(deploy.url);
    return deploy;
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
    const deploy = <PublishDeploy> await response.json();
    deploy.url = this.resolveUrl(deploy.url);
    return deploy;
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

  // Resolve the URL into a form that can be used to address resources
  // (not just the root redirect). For example this form allows
  // social metadata cards to properly form links to images, and so on.
  private resolveUrl = (url: string) => {
    const match = url.match(kUrlResolveRegex);
    if (match) {
      return `https://${match[1]}.quarto.pub/${match[2]}`;
    } else {
      return url;
    }
  };
}

async function descriptionFromErrorResponse(response: Response) {
  // if there is a body, see if its a quarto pub error w/ description
  if (response.body) {
    try {
      const result = await response.json();
      if (typeof (result.description) === "string") {
        return result.description;
      }
    } catch {
      //
    }
  }
}
