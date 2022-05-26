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

const kQuartopubApi = `https://quartodev.pub/api`;

export class QuartopubClient {
  constructor(private readonly token_?: string) {
  }

  public async createTicket(): Promise<Ticket> {
    const response = await fetch(`${kQuartopubApi}/tickets`, {
      method: "POST",
    });
    return response.json() as unknown as Ticket;
  }

  public async showTicket(id: string): Promise<Ticket> {
    const response = await fetch(`${kQuartopubApi}/tickets/${id}`, {
      method: "GET",
    });
    return response.json() as unknown as Ticket;
  }

  public async exchangeTicket(id: string) : Promise<AccessToken> {
    const response = await fetch(`${kQuartopubApi}/tickets/${id}/exchange`, {
      method: "POST",
    });
    return response.json() as unknown as AccessToken;
  } 
}
