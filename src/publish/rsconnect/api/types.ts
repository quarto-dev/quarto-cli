/*
* types.ts
*
* Copyright (C) 2020 by RStudio, PBC
*
*/

export class ApiError extends Error {
  public constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`API Error: ${status} - ${statusText}`);
  }
}

export type User = {
  guid: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  user_role: string;
  created_time: string;
  updated_time: string;
  active_time: string;
  confirmed: boolean;
  locked: boolean;
};

export type Content = {
  guid: string;
  name: string;
  title: string;
  content_url: string;
  dashboard_url: string;
};
