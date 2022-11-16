/*
* types.ts
*
* Copyright (C) 2020-2022 Posit Software, PBC
*
*/

export type AccessToken = {
  id: string;
  application_token: string;
  account_identifier: string;
  email?: string | null;
  created_timestamp: string;
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
  created_timestamp: string;
  authorized: boolean;
  authorization_url: string;
};

export type AccountSite = {
  url: string;
};
