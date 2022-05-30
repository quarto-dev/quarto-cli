/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export type AccessToken = {
  id: string;
  applicationToken: string;
  userIdentifier: string;
  email?: string | null;
  createdTimestamp: string;
};

export type PublishDeploy = {
  id: string;
  state: string;
  required: string[];
  url: string;
  admin_url: string;
};

export type Site = {
  id: string;
  url: string;
};

export type Ticket = {
  id: string;
  createdTimestamp: string;
  authorized: boolean;
  authorizationURL: string;
};
