/*
* index.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type Ticket = {
  id: string;
  createdTimestamp: string;
  authorized: boolean;
  authorizationURL: string;
};

export type AccessToken = {
  id: string;
  userToken: string;
  userIdentifier: string;
  email?: string | null;
  createdTimestamp: string;
};

const kQuartopubApi = `https://quartodev.pub/api/v1`;

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`API Error: ${status} (${statusText})`);
  }
}

export class QuartopubClient {
  constructor(private readonly token_?: string) {
  }

  public async createTicket(clientId: string): Promise<Ticket> {
    const response = await fetch(
      `${kQuartopubApi}/tickets?` + new URLSearchParams({
        applicationId: clientId,
      }),
      {
        method: "POST",
      },
    );
    return handleResponse<Ticket>(response);
  }

  public async showTicket(id: string): Promise<Ticket> {
    const response = await fetch(`${kQuartopubApi}/tickets/${id}`, {
      method: "GET",
    });
    return handleResponse<Ticket>(response);
  }

  public async exchangeTicket(id: string): Promise<AccessToken> {
    const response = await fetch(`${kQuartopubApi}/tickets/${id}/exchange`, {
      method: "POST",
    });
    return handleResponse<AccessToken>(response);
  }
}

function handleResponse<T>(response: Response) {
  if (response.status !== 200) {
    const error = response.json() as unknown as {
      code: number;
      message: string;
    };
    throw new ApiError(error.code, error.message);
  } else {
    return response.json() as unknown as T;
  }
}
